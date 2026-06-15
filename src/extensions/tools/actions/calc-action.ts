/**
 * Calc Action
 *
 * Evaluates a basic math expression safely.
 */

function evaluateArithmetic(expr: string): number {
  // Tokenize
  const tokens: Array<{ type: 'number'; value: number } | { type: 'operator'; value: string }> = [];
  for (let i = 0; i < expr.length; ) {
    const c = expr[i];
    if (c >= '0' && c <= '9') {
      let num = '';
      while (i < expr.length && ((expr[i] >= '0' && expr[i] <= '9') || expr[i] === '.')) {
        num += expr[i++];
      }
      tokens.push({ type: 'number', value: parseFloat(num) });
    } else if ('+-*/()'.includes(c)) {
      tokens.push({ type: 'operator', value: c });
      i++;
    } else {
      throw new Error('Invalid character in expression');
    }
  }

  // Shunting-yard to RPN
  const output: Array<{ type: 'number'; value: number } | { type: 'operator'; value: string }> = [];
  const ops: Array<{ type: 'operator'; value: string }> = [];
  const prec: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };
  for (const token of tokens) {
    if (token.type === 'number') {
      output.push(token);
    } else {
      if (token.value === '(') {
        ops.push(token);
      } else if (token.value === ')') {
        while (ops.length && ops[ops.length - 1].value !== '(') {
          output.push(ops.pop()!);
        }
        ops.pop(); // remove '('
      } else {
        while (
          ops.length &&
          ops[ops.length - 1].type === 'operator' &&
          prec[ops[ops.length - 1].value] >= prec[token.value]
        ) {
          output.push(ops.pop()!);
        }
        ops.push(token);
      }
    }
  }
  while (ops.length) {
    output.push(ops.pop()!);
  }

  // Evaluate RPN
  const stack: number[] = [];
  for (const token of output) {
    if (token.type === 'number') {
      stack.push(token.value);
    } else {
      const b = stack.pop();
      const a = stack.pop();
      if (a === undefined || b === undefined) throw new Error('Invalid expression');
      switch (token.value) {
        case '+': stack.push(a + b); break;
        case '-': stack.push(a - b); break;
        case '*': stack.push(a * b); break;
        case '/': stack.push(a / b); break;
        default: throw new Error('Unknown operator');
      }
    }
  }
  const result = stack[0];
  if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
    throw new Error('Invalid calculation result');
  }
  return result;
}

export const calcAction = {
  execute: async (params: { expression: string }) => {
    const expr = params.expression.replace(/\s/g, '');
    // Simple validation: only digits, operators +-*/, parentheses, decimal points
    if (!/^[0-9+\-*/().]+$/.test(expr)) {
      throw new Error('Invalid expression. Only numbers and operators (+, -, *, /) allowed.');
    }
    const result = evaluateArithmetic(expr);
    return {
      content: [{ type: "text", text: `${params.expression} = ${result}` }],
      details: { expression: params.expression, result },
    };
  },
  getParameters: () => ({
    type: "object",
    properties: {
      expression: { type: "string", description: "Math expression to evaluate (e.g., '2 + 3 * 4')" }
    },
    required: ['expression'],
  }),
};
