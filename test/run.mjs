import { scanDocument, formatNumber, analyzeLine } from "./evaluator.mjs";

const fmt = { decimals: 2, grouping: true };
let fail = 0;

function check(name, lines, expected) {
	const { pending } = scanDocument(lines);
	const got = {};
	for (const [n, v] of pending) got[n] = formatNumber(v, fmt);
	const ok = JSON.stringify(got) === JSON.stringify(expected);
	if (!ok) fail++;
	console.log(`${ok ? "OK  " : "FAIL"} ${name}${ok ? "" : `\n     got ${JSON.stringify(got)}\n     exp ${JSON.stringify(expected)}`}`);
}

check("soma simples", ["10+50="], { 1: "60" });
check("com espaços", ["10 + 50 ="], { 1: "60" });
check("variáveis", ["Abacaxi = 50", "Banana = 60", "Abacaxi + Banana ="], { 3: "110" });
check("case-insensitive", ["Abacaxi = 50", "abacaxi * 2 ="], { 2: "100" });
check("acentos", ["Preço = 12,50", "Preço * 4 ="], { 2: "50" });
check("nome com espaço", ["Custo total = 1.000", "Custo total / 4 ="], { 2: "250" });
check("formato BR", ["1.250,50 + 0,50 ="], { 1: "1.251" });
check("decimais", ["10 / 3 ="], { 1: "3,33" });
check("precedência", ["2 + 3 * 4 =", "(2 + 3) * 4 ="], { 1: "14", 2: "20" });
check("x e ×", ["3 x 4 =", "3 × 4 =", "3x4="], { 1: "12", 2: "12", 3: "12" });
check("percentual", ["200 + 10% =", "200 * 10% =", "50% ="], { 1: "220", 2: "20", 3: "0,5" });
check("potência", ["2^10 ="], { 1: "1.024" });
check("R$", ["R$ 100 + R$ 50 ="], { 1: "150" });
check("resultado já escrito", ["10+50=60"], {});
check("resultado manual diferente", ["10+50=70"], {});
check("variável a partir de conta", ["A = 10", "B = A * 2", "B + 1 ="], { 3: "21" });
check("variável com resultado aceito", ["A = 10", "Total = A + 5 = 15", "Total ="], { 3: "15" });
check("define e calcula", ["A = 10", "Total = A * 3 =", "Total + 1 ="], { 2: "30", 3: "31" });
check("redefinição", ["A = 1", "A = 5", "A * 2 ="], { 3: "10" });
check("ordem de cima p/ baixo", ["A * 2 =", "A = 5"], {});
check("número sozinho ignorado", ["10 ="], {});
check("texto ignorado", ["Status = pendente", "Status ="], {});
check("comparações ignoradas", ["a == b", "x <= 10", "if a >= b"], {});
check("lista e checkbox", ["- 10 + 5 =", "- [ ] 2*3=", "1. 4/2 ="], { 1: "15", 2: "6", 3: "2" });
check("rótulo com dois pontos", ["Total: 10 + 50 ="], { 1: "60" });
check("divisão por zero", ["10 / 0 ="], {});
check("code block ignorado", ["```", "1+1=", "```", "2+2="], { 4: "4" });
check("frontmatter ignorado", ["---", "a: 1+1=", "---", "3+3="], { 4: "6" });
check("negativos", ["A = -5", "A + 2 =", "-(3) * 2 ="], { 2: "-3", 3: "-6" });
check("float noise", ["0,1 + 0,2 ="], { 1: "0,3" });
check("milhar grande", ["1.000.000 * 2 ="], { 1: "2.000.000" });

console.log(formatNumber(1234567.891, { decimals: 2, grouping: false }) === "1234567,89" ? "OK   sem separador" : (fail++, "FAIL sem separador"));
console.log(fail ? `\n${fail} falha(s)` : "\nTodos os testes passaram");
process.exit(fail ? 1 : 0);
