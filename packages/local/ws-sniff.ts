/**
 * 直接连接 cc-web WebSocket，监听真实消息流
 * 用于诊断 token/上下文数据是否从 local 服务正确发出
 */
import WebSocket from "ws";

const WS_URL = "ws://localhost:3001/ws/browser";

const ws = new WebSocket(WS_URL);

ws.on("open", () => {
  console.log("已连接 cc-web relay\n");
  // 先列出现有会话
  ws.send(JSON.stringify({ type: "list_sessions" }));
});

ws.on("message", (data) => {
  const text = data.toString().trim();

  for (const line of text.split("\n").filter((l) => l.trim())) {
    try {
      const msg = JSON.parse(line);

      // 只记录关键类型
      if (msg.type === "session_info") {
        console.log(`📁 会话: ${msg.sessionId?.substring(0, 8)}... 状态=${msg.status} 项目=${msg.projectPath}`);
      } else if (msg.type === "sessions_list") {
        console.log(`📋 共 ${msg.sessions?.length || 0} 个会话`);
      } else if (msg.type === "claude_json") {
        const data = msg.data;
        if (data?.type === "system" && data?.subtype === "init") {
          console.log(`🔧 System Init: model="${data.model}", session_id=${data.session_id?.substring(0, 16)}...`);
        } else if (data?.type === "result") {
          console.log(`\n📊 === RESULT 消息 ===`);
          console.log(`   subtype: ${data.subtype}`);
          console.log(`   has usage: ${!!data.usage}`);
          console.log(`   has modelUsage: ${!!data.modelUsage}`);
          console.log(`   total_cost_usd: ${data.total_cost_usd}`);
          if (data.usage) {
            console.log(`   usage.input_tokens: ${data.usage.input_tokens}`);
            console.log(`   usage.output_tokens: ${data.usage.output_tokens}`);
            console.log(`   usage.cache_read_input_tokens: ${data.usage.cache_read_input_tokens}`);
          }
          if (data.modelUsage) {
            const models = Object.keys(data.modelUsage);
            console.log(`   models: ${models.join(", ")}`);
            for (const m of models) {
              const mu = data.modelUsage[m];
              console.log(`   [${m}] inputTokens=${mu.inputTokens} outputTokens=${mu.outputTokens} contextWindow=${mu.contextWindow}`);
            }
          }
          console.log(`   → 前端应调用 onTokenUsage(${data.usage ? JSON.stringify({
            inputTokens: data.usage.input_tokens,
            outputTokens: data.usage.output_tokens,
            cacheReadTokens: data.usage.cache_read_input_tokens,
            costUSD: data.total_cost_usd,
            contextWindow: data.modelUsage ? Object.values(data.modelUsage)[0]?.contextWindow || 0 : 0,
          }) : "null"})`);
          console.log(`========================\n`);
        } else if (data?.type === "assistant") {
          const textBlocks = data.message?.content?.filter((c: any) => c.type === "text").length || 0;
          const toolBlocks = data.message?.content?.filter((c: any) => c.type === "tool_use").length || 0;
          console.log(`🤖 Assistant: ${textBlocks} text + ${toolBlocks} tool_use`);
        }
      } else if (msg.type === "done") {
        console.log(`✅ Done: ${msg.sessionId?.substring(0, 8)}...`);
      } else if (msg.type === "error") {
        console.log(`❌ Error: ${msg.error}`);
      }

      // 检查是否有 tokenUsage 和 modelUsage 的区别 — 可能是字段名不同
      if (msg.type === "claude_json" && msg.data?.type === "result") {
        console.log("  [调试] result 消息的所有顶层 key:", Object.keys(msg.data).join(", "));
        if (msg.data.usage) {
          console.log("  [调试] usage keys:", Object.keys(msg.data.usage).join(", "));
        }
        if (msg.data.modelUsage) {
          console.log("  [调试] modelUsage keys:", Object.keys(msg.data.modelUsage));
          const firstModel = msg.data.modelUsage[Object.keys(msg.data.modelUsage)[0]];
          if (firstModel) {
            console.log("  [调试] modelUsage[first] keys:", Object.keys(firstModel).join(", "));
          }
        }
      }
    } catch {
      // 忽略
    }
  }
});

ws.on("error", (err) => {
  console.error("WebSocket 错误:", err.message);
  process.exit(1);
});

ws.on("close", (code, reason) => {
  console.log(`WebSocket 关闭: code=${code}, reason=${reason?.toString() || "无"}`);
  process.exit(0);
});

// 30 秒后退出（需要手动 Ctrl+C 提前退出）
setTimeout(() => {
  console.log("\n30 秒超时，退出");
  ws.close();
  process.exit(0);
}, 30000);
