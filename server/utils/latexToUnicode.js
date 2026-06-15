/**
 * latexToUnicode.js
 *
 * Converts inline LaTeX math expressions ($...$  and $$...$$) in markdown
 * to their Unicode equivalents so they render correctly in pdfmake PDFs and
 * plain HTML exports without requiring a full KaTeX/MathJax setup.
 *
 * Strategy:
 *   1. Walk the string and find every $...$ / $$...$$ span.
 *   2. Replace known LaTeX command sequences with Unicode characters.
 *   3. Strip any remaining unknown backslash-commands and braces.
 *   4. For HTML output, wrap the result in a <span class="math"> so it can
 *      be styled differently if desired.
 */

// ─── Symbol table ────────────────────────────────────────────────────────────
// Add entries here whenever a new symbol is needed.
const LATEX_SYMBOLS = {
  // Arrows
  rightarrow: '→', Rightarrow: '⇒',
  leftarrow: '←',  Leftarrow: '⇐',
  leftrightarrow: '↔', Leftrightarrow: '⇔',
  uparrow: '↑',    Uparrow: '⇑',
  downarrow: '↓',  Downarrow: '⇓',
  nearrow: '↗',    searrow: '↘',
  nwarrow: '↖',    swarrow: '↙',
  to: '→',         gets: '←',
  mapsto: '↦',     longmapsto: '⟼',
  longrightarrow: '⟶', longleftarrow: '⟵',

  // Relations
  leq: '≤',   geq: '≥',  neq: '≠',
  le: '≤',    ge: '≥',   ne: '≠',
  approx: '≈', sim: '∼', simeq: '≃', cong: '≅',
  equiv: '≡',  propto: '∝',
  subset: '⊂', supset: '⊃', subseteq: '⊆', supseteq: '⊇',
  in: '∈',    notin: '∉',  ni: '∋',
  ll: '≪',    gg: '≫',
  perp: '⊥',  parallel: '∥', mid: '∣',
  prec: '≺',  succ: '≻',

  // Operators / math
  pm: '±',    mp: '∓',
  times: '×', div: '÷',   cdot: '·',
  circ: '∘',  bullet: '•',
  oplus: '⊕', ominus: '⊖', otimes: '⊗', oslash: '⊘',
  cap: '∩',   cup: '∪',
  wedge: '∧', vee: '∨',
  neg: '¬',   lnot: '¬',
  forall: '∀', exists: '∃', nexists: '∄',
  partial: '∂', nabla: '∇',
  infty: '∞',
  emptyset: '∅', varnothing: '∅',
  sqrt: '√',
  sum: '∑',   prod: '∏',  coprod: '∐',
  int: '∫',   oint: '∮',
  therefore: '∴', because: '∵',

  // Greek lowercase
  alpha: 'α', beta: 'β',   gamma: 'γ',  delta: 'δ',
  epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η',
  theta: 'θ',  vartheta: 'ϑ', iota: 'ι', kappa: 'κ',
  lambda: 'λ', mu: 'μ',    nu: 'ν',     xi: 'ξ',
  pi: 'π',     varpi: 'ϖ', rho: 'ρ',    varrho: 'ϱ',
  sigma: 'σ',  varsigma: 'ς', tau: 'τ', upsilon: 'υ',
  phi: 'φ',    varphi: 'φ', chi: 'χ',   psi: 'ψ',
  omega: 'ω',

  // Greek uppercase
  Gamma: 'Γ',   Delta: 'Δ',   Theta: 'Θ',
  Lambda: 'Λ',  Xi: 'Ξ',      Pi: 'Π',
  Sigma: 'Σ',   Upsilon: 'Υ', Phi: 'Φ',
  Psi: 'Ψ',     Omega: 'Ω',

  // Dots / spacing
  ldots: '…',  cdots: '⋯',  vdots: '⋮',  ddots: '⋱',
  quad: ' ',   qquad: '  ',

  // Misc
  hbar: 'ℏ',   ell: 'ℓ',   wp: '℘',
  Re: 'ℜ',     Im: 'ℑ',
  aleph: 'ℵ',  beth: 'ℶ',
  dagger: '†', ddagger: '‡',
  star: '★',   ast: '∗',
  langle: '⟨', rangle: '⟩',
  lceil: '⌈',  rceil: '⌉',
  lfloor: '⌊', rfloor: '⌋',

  // Fractions / superscripts expressed as text
  frac12: '½', frac14: '¼', frac34: '¾',
};

// Pre-build a single regex that matches all known commands at once
const CMD_RE = new RegExp(
  '\\\\(' + Object.keys(LATEX_SYMBOLS).join('|') + ')(?![a-zA-Z])',
  'g'
);

/**
 * Convert a single LaTeX math string (content between $ delimiters, without
 * the $ signs themselves) to a readable Unicode string.
 */
function latexExprToText(expr) {
  let result = expr.trim();

  // 1. Replace \frac{a}{b} → a/b
  result = result.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1/$2)');

  // 2. Replace \sqrt{x} → √x, \sqrt[n]{x} → ⁿ√x
  result = result.replace(/\\sqrt\[([^\]]*)\]\{([^}]*)\}/g, '$1√$2');
  result = result.replace(/\\sqrt\{([^}]*)\}/g, '√$1');
  result = result.replace(/\\sqrt\s+(\S+)/g, '√$1');

  // 3. Replace ^{...} → superscript text, _{...} → subscript text
  //    (no Unicode combining available for all chars, keep as plain text)
  result = result.replace(/\^\{([^}]*)\}/g, (_, p) => toSuperscript(p));
  result = result.replace(/_\{([^}]*)\}/g, (_, p) => toSubscript(p));
  result = result.replace(/\^([^{])/g, (_, p) => toSuperscript(p));
  result = result.replace(/_([^{_\s])/g, (_, p) => toSubscript(p));

  // 4. Known symbol commands
  result = result.replace(CMD_RE, (_, cmd) => LATEX_SYMBOLS[cmd] || `\\${cmd}`);

  // 5. Strip remaining unknown \commands (keep their argument if braced)
  result = result.replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1');
  result = result.replace(/\\[a-zA-Z]+\*/g, '');
  result = result.replace(/\\[a-zA-Z]+/g, '');

  // 6. Remove remaining bare braces { }
  result = result.replace(/[{}]/g, '');

  // 7. Collapse multiple spaces
  result = result.replace(/  +/g, ' ').trim();

  return result;
}

// ── Superscript / subscript mappings ─────────────────────────────────────────
const SUP_MAP = { '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶',
  '7':'⁷','8':'⁸','9':'⁹','+':'⁺','-':'⁻','=':'⁼','(':'⁽',')':'⁾',
  'a':'ᵃ','b':'ᵇ','c':'ᶜ','d':'ᵈ','e':'ᵉ','f':'ᶠ','g':'ᵍ','h':'ʰ',
  'i':'ⁱ','j':'ʲ','k':'ᵏ','l':'ˡ','m':'ᵐ','n':'ⁿ','o':'ᵒ','p':'ᵖ',
  'r':'ʳ','s':'ˢ','t':'ᵗ','u':'ᵘ','v':'ᵛ','w':'ʷ','x':'ˣ','y':'ʸ',
  'z':'ᶻ' };

const SUB_MAP = { '0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆',
  '7':'₇','8':'₈','9':'₉','+':'₊','-':'₋','=':'₌','(':'₍',')':'₎',
  'a':'ₐ','e':'ₑ','o':'ₒ','x':'ₓ','i':'ᵢ','j':'ⱼ','k':'ₖ','l':'ₗ',
  'm':'ₘ','n':'ₙ','p':'ₚ','r':'ᵣ','s':'ₛ','t':'ₜ','u':'ᵤ','v':'ᵥ' };

function toSuperscript(s) {
  return [...s].map(c => SUP_MAP[c] || c).join('');
}
function toSubscript(s) {
  return [...s].map(c => SUB_MAP[c] || c).join('');
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Replace all $...$ and $$...$$ blocks in a markdown string with their
 * Unicode equivalents.  Safe to call on plain text — it only touches content
 * inside dollar-sign delimiters.
 *
 * @param {string} markdown
 * @returns {string}
 */
function processLatex(markdown) {
  if (!markdown || !markdown.includes('$')) return markdown;

  let result = '';
  let i = 0;
  const len = markdown.length;

  while (i < len) {
    if (markdown[i] === '$') {
      // Check for $$ (display math)
      const isDisplay = markdown[i + 1] === '$';
      const delim = isDisplay ? '$$' : '$';
      const start = i + delim.length;
      const end = markdown.indexOf(delim, start);

      if (end === -1) {
        // No closing delimiter — emit literally
        result += markdown[i];
        i++;
        continue;
      }

      const expr = markdown.slice(start, end);
      result += latexExprToText(expr);
      i = end + delim.length;
    } else {
      result += markdown[i];
      i++;
    }
  }

  return result;
}

module.exports = { processLatex, latexExprToText };
