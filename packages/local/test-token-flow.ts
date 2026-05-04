/**
 * 独立测试：验证 Claude CLI → 前端 StatusBar 的 token/上下文 数据流
 *
 * 模拟 Claude SDK 返回的 NDJSON 消息，测试提取逻辑是否与 useStreamParser.ts 一致
 */

// === 复制自 useStreamParser.ts 的核心提取逻辑（纯函数，去 React 依赖） ===

interface NonNullableUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
}

interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  webSearchRequests: number;
  costUSD: number;
  contextWindow: number;
}

interface SDKResultMessage {
  type: "result";
  subtype: "success";
  usage: NonNullableUsage;
  modelUsage: { [modelName: string]: ModelUsage };
  total_cost_usd: number;
}

interface SDKSystemMessage {
  type: "system";
  subtype: "init";
  model: string;
  session_id: string;
}

type SDKMessage = SDKResultMessage | SDKSystemMessage;

function extractTokenUsage(claudeData: SDKMessage) {
  if (claudeData.type !== "result") return null;
  if (!claudeData.usage) return null;

  const u = claudeData.usage;
  let contextWindow = 0;
  const modelUsage = claudeData.modelUsage;
  if (modelUsage) {
    const modelNames = Object.keys(modelUsage);
    if (modelNames.length > 0) {
      contextWindow = modelUsage[modelNames[0]].contextWindow || 0;
    }
  }

  return {
    inputTokens: u.input_tokens || 0,
    outputTokens: u.output_tokens || 0,
    cacheReadTokens: u.cache_read_input_tokens || 0,
    costUSD: claudeData.total_cost_usd || 0,
    contextWindow,
  };
}

function extractModel(claudeData: SDKMessage) {
  if (claudeData.type !== "system" || claudeData.subtype !== "init") return null;
  return (claudeData as SDKSystemMessage).model || null;
}

// === 模拟 Claude CLI 返回的真实数据 ===

// 模拟 system/init 消息（每次 --resume 启动时输出）
const mockInit: SDKSystemMessage = {
  type: "system",
  subtype: "init",
  model: "deepseek-v4-pro",
  session_id: "test-sid-12345678",
};

// 模拟 result 消息（每次回复结束时输出）
const mockResult: SDKResultMessage = {
  type: "result",
  subtype: "success",
  usage: {
    input_tokens: 12450,
    output_tokens: 3200,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
  },
  modelUsage: {
    "deepseek-v4-pro": {
      inputTokens: 12450,
      outputTokens: 3200,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
      webSearchRequests: 0,
      costUSD: 0.035,
      contextWindow: 131072,  // 128K
    },
  },
  total_cost_usd: 0.035,
};

// === 测试执行 ===

console.log("=== 测试 1: 提取模型名称 ===");
const model = extractModel(mockInit);
console.log(`输入: system/init, model="${mockInit.model}"`);
console.log(`提取结果: ${model}`);
console.log(model === "deepseek-v4-pro" ? "✅ 通过" : "❌ 失败");

console.log("\n=== 测试 2: 提取 Token 用量 ===");
const usage = extractTokenUsage(mockResult);
console.log("输入: result 消息");
console.log(JSON.stringify(mockResult, null, 2));
console.log(`\n提取结果:`);
console.log(JSON.stringify(usage, null, 2));

const checks = [
  { label: "inputTokens", expected: 12450, actual: usage?.inputTokens },
  { label: "outputTokens", expected: 3200, actual: usage?.outputTokens },
  { label: "cacheReadTokens", expected: 0, actual: usage?.cacheReadTokens },
  { label: "costUSD", expected: 0.035, actual: usage?.costUSD },
  { label: "contextWindow", expected: 131072, actual: usage?.contextWindow },
];

let allPass = true;
for (const check of checks) {
  const pass = check.actual === check.expected;
  console.log(`${pass ? "✅" : "❌"} ${check.label}: 期望=${check.expected}, 实际=${check.actual}`);
  if (!pass) allPass = false;
}

// === 测试 3: 模拟 StatusBar 显示 ===
console.log("\n=== 测试 3: StatusBar 显示效果 ===");
if (usage && usage.contextWindow > 0) {
  const totalTokens = usage.inputTokens + usage.cacheReadTokens;
  const pct = Math.min(100, (totalTokens / usage.contextWindow) * 100);
  const fmt = (n: number) =>
    n >= 1000000 ? (n / 1000000).toFixed(1) + "M" : n >= 1000 ? (n / 1000).toFixed(1) + "K" : String(n);

  console.log(`模型: ${model || "未知"}`);
  console.log(`Tokens: ${fmt(usage.inputTokens)} in / ${fmt(usage.outputTokens)} out`);
  console.log(`费用: $${usage.costUSD.toFixed(4)}`);
  console.log(`上下文: ${fmt(totalTokens)} / ${fmt(usage.contextWindow)} (${pct.toFixed(0)}%)`);
  console.log(`进度条: [${"█".repeat(Math.ceil(pct / 5))}${"░".repeat(20 - Math.ceil(pct / 5))}] ${pct.toFixed(0)}%`);

  if (pct > 0) {
    console.log("✅ StatusBar 可以正确显示百分比和进度条");
  }
}

// === 测试 4: 模拟 WebSocket 消息包装 ===
console.log("\n=== 测试 4: WebSocket StreamResponse 包装 ===");

// 这是 local 服务发往 relay 的格式
const wsMessage = {
  type: "claude_json" as const,
  data: mockResult,
  sessionId: "test-session-123",
};
console.log("发送格式:", JSON.stringify(wsMessage).substring(0, 100) + "...");

// 这是前端 handleRawMessage 收到的格式（JSON 字符串）
const rawMessage = JSON.stringify(wsMessage);

// 模拟 processStreamLine 的解析
const parsed = JSON.parse(rawMessage);
if (parsed.type === "claude_json" && parsed.data) {
  const extracted = extractTokenUsage(parsed.data);
  if (extracted) {
    console.log("✅ WebSocket → StreamResponse → extractTokenUsage 链路正常");
    console.log(`   contextWindow=${extracted.contextWindow}, inputTokens=${extracted.inputTokens}`);
  } else {
    console.log("❌ extractTokenUsage 返回 null");
  }
} else {
  console.log("❌ 消息类型不匹配");
}

// === 测试 5: isResultMessage 类型守卫 ===
console.log("\n=== 测试 5: isResultMessage 类型守卫 ===");
function isResultMessage(data: unknown): data is { type: "result" } {
  return typeof data === "object" && data !== null && "type" in data && (data as any).type === "result";
}
console.log(`mockResult → ${isResultMessage(mockResult) ? "✅ 识别为 result" : "❌ 未识别"}`);
console.log(`mockInit → ${isResultMessage(mockInit) ? "❌ 错误识别为 result" : "✅ 正确拒绝"}`);

console.log("\n=== 总结 ===");
if (allPass) {
  console.log("✅ 所有测试通过！数据提取逻辑正确。");
  console.log("如果浏览器仍不显示，问题可能是：");
  console.log("  1. Vite HMR 未生效 → 浏览器按 Ctrl+Shift+R 硬刷新");
  console.log("  2. onTokenUsage 回调未被调用 → 检查 F12 控制台是否有 log");
  console.log("  3. silent catch 吞掉了错误 → 已修复，现在会 console.error");
} else {
  console.log("❌ 有测试失败，需要检查数据结构");
}
