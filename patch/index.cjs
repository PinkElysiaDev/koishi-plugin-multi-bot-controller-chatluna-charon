var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  Config: () => Config,
  apply: () => apply6,
  inject: () => inject,
  inject2: () => inject2,
  name: () => name
});
module.exports = __toCommonJS(src_exports);
var import_koishi6 = require("koishi");

// src/plugins/chat.ts
var import_messages2 = require("@langchain/core/messages");
var import_koishi2 = require("koishi");
var import_count_tokens2 = require("koishi-plugin-chatluna/llm-core/utils/count_tokens");

// src/utils.ts
var import_messages = require("@langchain/core/messages");
var import_koishi = require("koishi");
var import_marked = require("marked");
var import_he = __toESM(require("he"), 1);
var import_string = require("koishi-plugin-chatluna/utils/string");
var import_count_tokens = require("koishi-plugin-chatluna/llm-core/utils/count_tokens");
var import_prompt = require("koishi-plugin-chatluna/llm-core/chain/prompt");
var import_agent = require("koishi-plugin-chatluna/llm-core/agent");
var import_runnables = require("@langchain/core/runnables");
var import_koishi_plugin_chatluna = require("koishi-plugin-chatluna");
function isEmoticonStatement(text, elements) {
  if (elements.length === 1 && elements[0].attrs["span"]) {
    return "span";
  }
  const regex = /^[\p{P}\p{S}\p{Z}\p{M}\p{N}\p{L}\s]*\p{So}[\p{P}\p{S}\p{Z}\p{M}\p{N}\p{L}\s]*$/u;
  return regex.test(text) ? "emoji" : "text";
}
__name(isEmoticonStatement, "isEmoticonStatement");
function isOnlyPunctuation(text) {
  const regex = /^[.,;!?…·—–—()【】「」『』《》<>《》{}【】〔〕"":'\[\]@#￥%\^&\*\-+=|\\~？。`]+$/;
  return regex.test(text);
}
__name(isOnlyPunctuation, "isOnlyPunctuation");
function parseMessageContent(response) {
  const status = response.match(/<status>(.*?)<\/status>/s)?.[1];
  const patterns = [
    /<output>(.*?)<\/output>/gs,
    /<message_part>(.*?)<\/message_part>/gs,
    /<message[\s\S]*?<\/message>/gm
  ];
  let rawMessage;
  for (const pattern of patterns) {
    const matches = Array.from(response.matchAll(pattern));
    if (matches.length > 0) {
      rawMessage = pattern === patterns[2] ? matches[matches.length - 1][0] : matches[matches.length - 1][1];
      break;
    }
  }
  if (!rawMessage) {
    throw new Error("Failed to parse response: " + response);
  }
  const tempJson = parseXmlToObject(rawMessage);
  return {
    // Keep the original `<message ...>...</message>` so we can read attributes
    // (e.g. `quote="..."`) during element parsing.
    rawMessage,
    messageType: tempJson.type,
    status,
    sticker: tempJson.sticker
  };
}
__name(parseMessageContent, "parseMessageContent");
async function processElements(elements, voiceRender, config) {
  const result = [];
  const last = /* @__PURE__ */ __name(() => result.at(-1), "last");
  const canAppendAt = /* @__PURE__ */ __name(() => last()?.at(-2)?.type === "at", "canAppendAt");
  const ensureLast = /* @__PURE__ */ __name(() => {
    if (!last()) result.push([]);
  }, "ensureLast");
  const appendToLast = /* @__PURE__ */ __name((items, pendingQuote) => {
    if (items.length === 0) return;
    ensureLast();
    const target = last();
    if (pendingQuote?.id && !pendingQuote.used) {
      target.unshift((0, import_koishi.h)("quote", { id: pendingQuote.id }));
      pendingQuote.used = true;
    }
    target.push(...items);
  }, "appendToLast");
  const pushFragment = /* @__PURE__ */ __name((items, pendingQuote) => {
    if (items.length === 0) {
      result.push([]);
      return;
    }
    if (pendingQuote?.id && !pendingQuote.used) {
      result.push([(0, import_koishi.h)("quote", { id: pendingQuote.id }), ...items]);
      pendingQuote.used = true;
      return;
    }
    result.push(items);
  }, "pushFragment");
  const startNewFragmentIfNeeded = /* @__PURE__ */ __name(() => {
    if (last()?.length) result.push([]);
  }, "startNewFragmentIfNeeded");
  const process = /* @__PURE__ */ __name(async (els, pendingQuote) => {
    for (const el of els) {
      if (el.type === "text") {
        if (el.attrs.code || el.attrs.span) {
          pushFragment([el], pendingQuote);
        } else if (el.attrs.voice && voiceRender) {
          pushFragment(await voiceRender(el), pendingQuote);
        } else if (config?.splitSentence) {
          for (const text of splitSentence(
            import_he.default.decode(el.attrs.content)
          ).filter(Boolean)) {
            canAppendAt() ? appendToLast([import_koishi.h.text(text)], pendingQuote) : pushFragment([import_koishi.h.text(text)], pendingQuote);
          }
        } else {
          canAppendAt() ? appendToLast([el], pendingQuote) : pushFragment([el], pendingQuote);
        }
      } else if (["em", "strong", "del", "p"].includes(el.type)) {
        el.children ? await process(el.children, pendingQuote) : pushFragment([el], pendingQuote);
      } else if (el.type === "at") {
        last() ? appendToLast([import_koishi.h.text(" "), el, import_koishi.h.text(" ")], pendingQuote) : pushFragment([import_koishi.h.text(" "), el, import_koishi.h.text(" ")], pendingQuote);
      } else if (el.type === "img" && !el.attrs.sticker) {
        last() ? appendToLast([el], pendingQuote) : pushFragment([el], pendingQuote);
      } else if (el.type === "message" && el.attrs.span && el.attrs.block) {
        startNewFragmentIfNeeded();
        const blockQuote = el.attrs.quote ? { id: String(el.attrs.quote), used: false } : void 0;
        await process(el.children, blockQuote);
        startNewFragmentIfNeeded();
      } else if (el.type === "message" && el.attrs.span) {
        await process(el.children, pendingQuote);
      } else if (el.type === "face") {
        last() ? appendToLast([el], pendingQuote) : pushFragment([el], pendingQuote);
      } else {
        canAppendAt() ? appendToLast([el], pendingQuote) : pushFragment([el], pendingQuote);
      }
    }
  }, "process");
  await process(elements);
  for (const fragment of result) {
    if (fragment[0]?.type !== "quote") continue;
    const hasIncompatibleType = fragment.some(
      (element) => element.type === "audio" || element.type === "message"
    );
    if (hasIncompatibleType) fragment.shift();
  }
  return result.filter((fragment) => fragment.length > 0);
}
__name(processElements, "processElements");
function processTextMatches(rawMessage, useAt = true, markdownRender = true) {
  const currentElements = [];
  let parsedMessage = "";
  const tokens = textMatchLexer(rawMessage);
  if (tokens.length === 0) {
    return {
      currentElements: markdownRender ? transform(rawMessage) : [(0, import_koishi.h)("text", { content: rawMessage })],
      parsedMessage: rawMessage
    };
  }
  let lastIndex = 0;
  for (const token of tokens) {
    const before = rawMessage.substring(lastIndex, token.start);
    if (before.trim()) {
      parsedMessage += before;
      if (markdownRender) {
        currentElements.push(...transform(before));
      } else {
        currentElements.push((0, import_koishi.h)("text", { content: before }));
      }
    }
    switch (token.type) {
      case "at":
        if (useAt) {
          currentElements.push(import_koishi.h.at(token.content));
        }
        break;
      case "emo":
        currentElements.push(
          (0, import_koishi.h)("text", { span: true, content: token.content })
        );
        break;
      case "pre":
      case "message": {
        parsedMessage += token.content;
        const children = token.children ? processTextMatches(token.content, useAt, markdownRender).currentElements : [(0, import_koishi.h)("text", { span: true, content: token.content })];
        const isTopLevelMessage = token.extra?.topLevel === "true";
        const quoteId = isTopLevelMessage ? token.extra?.quote : void 0;
        currentElements.push(
          (0, import_koishi.h)(
            "message",
            {
              span: true,
              ...isTopLevelMessage ? { block: true } : {},
              ...quoteId ? { quote: quoteId } : {}
            },
            ...children
          )
        );
        break;
      }
      case "face": {
        currentElements.push(
          (0, import_koishi.h)("face", {
            id: token.content
          })
        );
        break;
      }
      case "voice":
        currentElements.push(
          (0, import_koishi.h)("message", { span: true }, [
            (0, import_koishi.h)("text", {
              voice: true,
              content: token.content,
              extra: token.extra
            })
          ])
        );
        break;
      case "sticker":
        currentElements.push((0, import_koishi.h)("message", [import_koishi.h.image(token.content)]));
        break;
      case "img":
        currentElements.push(
          import_koishi.h.image(token.content, {
            sticker: false
          })
        );
        break;
    }
    lastIndex = token.end;
  }
  const after = rawMessage.substring(lastIndex);
  if (after.trim()) {
    parsedMessage += after;
    if (markdownRender) {
      currentElements.push(...transform(after));
    } else {
      currentElements.push((0, import_koishi.h)("text", { content: after }));
    }
  }
  return { currentElements, parsedMessage };
}
__name(processTextMatches, "processTextMatches");
function textMatchLexer(input) {
  const tokens = [];
  let index = 0;
  const tagMappings = [
    { open: "<pre>", close: "</pre>", type: "pre", nested: true },
    { open: "<emo>", close: "</emo>", type: "emo", nested: false },
    {
      open: "<sticker>",
      close: "</sticker>",
      type: "sticker",
      nested: false
    },
    {
      open: "<img>",
      close: "</img>",
      type: "img",
      nested: false
    }
  ];
  const stack = [];
  while (index < input.length) {
    let matched = false;
    if (!matched && input.startsWith("<message", index)) {
      const openEnd = input.indexOf(">", index);
      if (openEnd !== -1) {
        const boundary = input.charAt(index + "<message".length);
        if (boundary === ">" || boundary === " " || boundary === "	") {
          const attrs = input.substring(
            index + "<message".length,
            openEnd
          );
          const quote = attrs.match(
            /\bquote\s*=\s*['"]([^'"]+)['"]/
          )?.[1];
          stack.push({
            type: "message",
            start: index,
            contentStart: openEnd + 1,
            extra: {
              ...quote ? { quote } : {},
              topLevel: stack.length === 0 ? "true" : "false"
            }
          });
          index = openEnd + 1;
          matched = true;
        }
      }
    }
    if (!matched && stack.length > 0 && stack[stack.length - 1].type === "message" && input.startsWith("</message>", index)) {
      const stackItem = stack.pop();
      if (stackItem) {
        const content = input.substring(stackItem.contentStart, index);
        const children = textMatchLexer(content);
        tokens.push({
          type: "message",
          content,
          extra: stackItem.extra,
          start: stackItem.start,
          end: index + "</message>".length,
          children
        });
        index += "</message>".length;
        matched = true;
      }
    }
    for (const { open, close, type, nested } of tagMappings) {
      if (input.startsWith(open, index)) {
        if (nested) {
          stack.push({ type, start: index });
          index += open.length;
          matched = true;
          break;
        } else if (stack.length === 0) {
          const endIndex = input.indexOf(close, index);
          if (endIndex !== -1) {
            const content = input.substring(
              index + open.length,
              endIndex
            );
            tokens.push({
              type,
              content,
              start: index,
              end: endIndex + close.length
            });
            index = endIndex + close.length;
            matched = true;
            break;
          }
        }
      } else if (nested && input.startsWith(close, index)) {
        const stackItem = stack.at(-1);
        if (stackItem?.type === type) {
          stack.pop();
          const content = input.substring(
            stackItem.start + open.length,
            index
          );
          const children = textMatchLexer(content);
          tokens.push({
            type,
            content,
            start: stackItem.start,
            end: index + close.length,
            children
          });
          index += close.length;
          matched = true;
          break;
        }
      }
    }
    if (!matched && stack.length === 0 && input.startsWith("<at", index)) {
      const endIndex = input.indexOf("</at>", index);
      if (endIndex !== -1) {
        const match = /<at\b[^>]*>(.*?)<\/at>/.exec(
          input.substring(index, endIndex + 5)
        );
        if (match) {
          tokens.push({
            type: "at",
            content: match[1],
            start: index,
            end: endIndex + 5
          });
          index = endIndex + 5;
          matched = true;
        }
      }
    }
    if (!matched && stack.length === 0 && input.startsWith("<face", index)) {
      const endIndex = input.indexOf("</face>", index);
      if (endIndex !== -1) {
        const match = /<face\b[^>]*>(.*?)<\/face>/.exec(
          input.substring(index, endIndex + 7)
        );
        if (match) {
          const openTagMatch = /<face\b([^>]*)>/.exec(
            input.substring(index, endIndex + 7)
          );
          let extra;
          if (openTagMatch && openTagMatch[1]) {
            const nameMatch = openTagMatch[1].match(
              /name=['"]([^'"]+)['"]/
            );
            if (nameMatch) {
              extra = { name: nameMatch[1] };
            }
          }
          tokens.push({
            type: "face",
            content: match[1],
            extra,
            start: index,
            end: endIndex + 7
          });
          index = endIndex + 7;
          matched = true;
        }
      }
    }
    if (!matched && stack.length === 0 && input.startsWith("<voice", index)) {
      const openTagEnd = input.indexOf(">", index);
      const endIndex = input.indexOf("</voice>", index);
      if (openTagEnd !== -1 && endIndex !== -1) {
        const hasAttributes = input.charAt(index + 6) === " ";
        let extra;
        if (hasAttributes) {
          const attributesString = input.substring(
            index + 6,
            openTagEnd
          );
          const idMatch = attributesString.match(/id=['"]([^'"]+)['"]/);
          if (idMatch) {
            extra = { id: idMatch[1] };
          }
        }
        const content = input.substring(openTagEnd + 1, endIndex);
        tokens.push({
          type: "voice",
          content,
          extra,
          start: index,
          end: endIndex + 8
        });
        index = endIndex + 8;
        matched = true;
      }
    }
    if (!matched) {
      index++;
    }
  }
  return tokens;
}
__name(textMatchLexer, "textMatchLexer");
async function parseResponse(response, useAt = true, voiceRender, config) {
  try {
    const { rawMessage, messageType, status, sticker } = parseMessageContent(response);
    const { currentElements, parsedMessage } = processTextMatches(
      rawMessage,
      useAt,
      config?.markdownRender ?? true
    );
    const resultElements = await processElements(
      currentElements,
      voiceRender,
      config
    );
    return {
      elements: resultElements,
      rawMessage: parsedMessage,
      status,
      sticker,
      messageType
    };
  } catch (e) {
    logger?.error(e);
    throw new Error("Failed to parse response: " + response);
  }
}
__name(parseResponse, "parseResponse");
function splitSentence(text) {
  if (isOnlyPunctuation(text)) return [text];
  const scorePattern = /\d+[:：]\d+/g;
  const scoreMatches = [...text.matchAll(scorePattern)];
  const protectedRanges = scoreMatches.map((m) => [
    m.index,
    m.index + m[0].length
  ]);
  const isProtected = /* @__PURE__ */ __name((index) => protectedRanges.some(([start, end]) => index >= start && index < end), "isProtected");
  const lines = text.split("\n").filter((l) => l.trim()).join(" ");
  const punct = [
    "，",
    "。",
    "？",
    "！",
    "；",
    "：",
    ",",
    "?",
    "!",
    ";",
    ":",
    "、",
    "~",
    "—",
    "\r"
  ];
  const retain = /* @__PURE__ */ new Set(["?", "!", "？", "！", "~"]);
  const mustSplit = /* @__PURE__ */ new Set(["。", "?", "！", "!", ":", "："]);
  const brackets = [
    "【",
    "】",
    "《",
    "》",
    "(",
    ")",
    "（",
    "）",
    "“",
    "”",
    "‘",
    "’",
    "'",
    "'",
    '"',
    '"'
  ];
  const result = [];
  let current = "";
  let bracketLevel = 0;
  for (let i = 0; i < lines.length; i++) {
    const char = lines[i];
    const next = lines[i + 1];
    if (isProtected(i)) {
      current += char;
      continue;
    }
    const bracketIdx = brackets.indexOf(char);
    if (bracketIdx > -1) {
      bracketLevel += bracketIdx % 2 === 0 ? 1 : -1;
      current += char;
      if (bracketLevel === 0 && current.length > 1) {
        result.push(current);
        current = "";
      } else if (bracketLevel === 1 && bracketIdx % 2 === 0) {
        if (current.length > 1) result.push(current);
        current = char;
      }
      continue;
    }
    if (bracketLevel > 0) {
      current += char;
      continue;
    }
    if (!punct.includes(char)) {
      current += char;
      continue;
    }
    if (retain.has(char)) current += char;
    if (retain.has(next) && retain.has(char) && next !== char) i++;
    if (current.length > 0 && (current.length > 2 || mustSplit.has(char))) {
      result.push(current);
      current = "";
    } else if (!retain.has(char) && current.length > 0) {
      current += char;
    }
  }
  if (current) result.push(current);
  return result.filter((item) => !punct.includes(item));
}
__name(splitSentence, "splitSentence");
function formatTimestamp(timestamp) {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return date.toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short"
  });
}
__name(formatTimestamp, "formatTimestamp");
function formatMessageString(message, enableMessageId) {
  let xmlMessage = `<message name='${message.name}'`;
  const id = message.id;
  if (id) xmlMessage += ` id='${id}'`;
  if (enableMessageId) {
    const id2 = message.messageId;
    if (id2) xmlMessage += ` messageId='${id2}'`;
  }
  if (message.timestamp) {
    const timestampString = formatTimestamp(message.timestamp);
    xmlMessage += ` timestamp='${timestampString}'`;
  }
  if (message.quote) {
    xmlMessage += ` quote='${formatMessageString(message.quote, enableMessageId)}'`;
  }
  xmlMessage += `>${message.content}</message>`;
  return xmlMessage;
}
__name(formatMessageString, "formatMessageString");
async function createChatLunaChain(ctx, llmRef, session) {
  const currentPreset = (0, import_koishi_plugin_chatluna.computed)(
    () => ({
      triggerKeyword: [""],
      rawText: "",
      messages: [],
      config: {}
    })
  );
  const chatPrompt = (0, import_koishi_plugin_chatluna.computed)(() => {
    const llm = llmRef.value;
    return new import_prompt.ChatLunaChatPrompt({
      preset: currentPreset,
      tokenCounter: /* @__PURE__ */ __name((text) => llm.getNumTokens(text), "tokenCounter"),
      sendTokenLimit: llm.invocationParams().maxTokenLimit ?? llm.getModelMaxContextSize(),
      promptRenderService: ctx.chatluna.promptRenderer
    });
  });
  const embeddingsRef = await createEmbeddingsModel(ctx);
  const toolListRef = ctx.chatluna.platform.getTools();
  const toolsListRef = (0, import_koishi_plugin_chatluna.computed)(
    () => toolListRef.value.map((tool) => ctx.chatluna.platform.getTool(tool))
  );
  const toolsRef = (0, import_agent.createToolsRef)({
    tools: toolsListRef,
    embeddings: embeddingsRef.value
  });
  const executorRef = (0, import_agent.createAgentExecutor)({
    llm: llmRef,
    tools: toolsRef.tools,
    prompt: chatPrompt.value,
    agentMode: "tool-calling",
    returnIntermediateSteps: true,
    handleParsingErrors: true,
    instructions: (0, import_koishi_plugin_chatluna.computed)(() => void 0)
  });
  return (0, import_koishi_plugin_chatluna.computed)(() => {
    return import_runnables.RunnableLambda.from((input, options) => {
      if (options?.configurable?.session) {
        const copyOfMessages = typeof input["chat_history"] === "string" ? [new import_messages.HumanMessage(input["chat_history"])] : [...input["chat_history"]];
        if (copyOfMessages.length === 0) {
          copyOfMessages.push(input.input);
        }
        toolsRef.update(options.configurable.session, copyOfMessages);
      }
      return executorRef.value.invoke(input, {
        callbacks: [
          {
            handleAgentAction(action) {
              logger.debug("Agent Action:", action);
            },
            handleToolEnd(output, runId, parentRunId, tags) {
              logger.debug(`Tool End: `, output);
            }
          }
        ],
        ...options ?? {}
      }).then(
        (output) => new import_messages.AIMessageChunk({
          content: output.output
        })
      );
    });
  });
}
__name(createChatLunaChain, "createChatLunaChain");
function createEmbeddingsModel(ctx) {
  const modelName = ctx.chatluna.config.defaultEmbeddings;
  const [platform, model] = (0, import_count_tokens.parseRawModelName)(modelName);
  return ctx.chatluna.createEmbeddings(platform, model);
}
__name(createEmbeddingsModel, "createEmbeddingsModel");
async function formatMessage(messages, config, model, systemPrompt, historyPrompt, focusMessage) {
  const maxTokens = config.maxTokens - 300;
  let currentTokens = 0;
  currentTokens += await model.getNumTokens(systemPrompt);
  currentTokens += await model.getNumTokens(historyPrompt);
  const calculatedMessages = [];
  let lastMessage;
  if (focusMessage && messages.includes(focusMessage)) {
    const xmlFocusMessage = formatMessageString(
      focusMessage,
      config.enableMessageId
    );
    const xmlFocusMessageToken = await model.getNumTokens(xmlFocusMessage);
    if (currentTokens + xmlFocusMessageToken <= maxTokens - 4) {
      currentTokens += xmlFocusMessageToken;
      lastMessage = xmlFocusMessage;
    }
  }
  for (let i = messages.length - 1; i >= 0; i--) {
    if (lastMessage && messages[i] === focusMessage) continue;
    const xmlMessage = formatMessageString(
      messages[i],
      config.enableMessageId
    );
    const xmlMessageToken = await model.getNumTokens(xmlMessage);
    if (currentTokens + xmlMessageToken > maxTokens - 4) {
      break;
    }
    currentTokens += xmlMessageToken;
    calculatedMessages.unshift(xmlMessage);
  }
  if (lastMessage === void 0) {
    lastMessage = calculatedMessages.pop();
  }
  if (lastMessage === void 0) {
    throw new Error(
      "lastMessage is undefined, please set the max token to be bigger"
    );
  }
  return [calculatedMessages, lastMessage];
}
__name(formatMessage, "formatMessage");
async function formatCompletionMessages(messages, tempMessages, humanMessage, config, model) {
  const maxTokens = config.maxTokens - 600;
  const systemMessage = messages.shift();
  let currentTokens = 0;
  currentTokens += await model.getNumTokens(
    (0, import_string.getMessageContent)(systemMessage.content)
  );
  currentTokens += await model.getNumTokens(
    (0, import_string.getMessageContent)(humanMessage.content)
  );
  const result = [];
  result.unshift(humanMessage);
  for (const imageMessage of tempMessages) {
    const imageTokens = await model.getNumTokens(
      (0, import_string.getMessageContent)(imageMessage.content)
    );
    result.unshift(imageMessage);
    if (currentTokens + imageTokens > maxTokens) {
      break;
    }
    currentTokens += imageTokens;
  }
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    const messageTokens = await model.getNumTokens(
      message.content
    );
    if (currentTokens + messageTokens > maxTokens) {
      break;
    }
    currentTokens += messageTokens;
    result.unshift(message);
  }
  logger.debug(`maxTokens: ${maxTokens}, currentTokens: ${currentTokens}`);
  result.unshift(systemMessage);
  return result;
}
__name(formatCompletionMessages, "formatCompletionMessages");
function parseXmlToObject(xml) {
  const messageMatches = xml.match(/<message(?:\s+.*?)?>(.*?)<\/message>/gs);
  if (!messageMatches) {
    throw new Error("Failed to parse response: " + xml);
  }
  if (messageMatches.length > 1) {
    return {
      name: "",
      id: "",
      type: "text",
      sticker: "",
      content: xml
    };
  }
  const singleMatch = xml.match(/<message(?:\s+(.*?))?>(.*?)<\/message>/s);
  if (!singleMatch) {
    throw new Error("Failed to parse response: " + xml);
  }
  const [, attributes = "", content = ""] = singleMatch;
  const getAttr = /* @__PURE__ */ __name((name2) => {
    if (!attributes) return "";
    const attrMatch = attributes.match(
      new RegExp(`${name2}=['"]?([^'"]+)['"]?`)
    );
    return attrMatch?.[1] || "";
  }, "getAttr");
  return {
    name: getAttr("name"),
    id: getAttr("id"),
    type: getAttr("type") || "text",
    sticker: getAttr("sticker"),
    content
  };
}
__name(parseXmlToObject, "parseXmlToObject");
function trimCompletionMessages(completionMessages, modelCompletionCount) {
  const limit = Math.max(0, Math.floor(modelCompletionCount)) * 2;
  if (limit === 0) {
    completionMessages.length = 0;
    return;
  }
  const overflow = completionMessages.length - limit;
  if (overflow > 0) {
    completionMessages.splice(0, overflow);
  }
}
__name(trimCompletionMessages, "trimCompletionMessages");
var tagRegExp = /<(\/?)([^!\s>/]+)([^>]*?)\s*(\/?)>/;
function renderToken(token) {
  if (token.raw.trim().length < 1) {
    return void 0;
  }
  if (token.type === "code") {
    return (0, import_koishi.h)("text", { code: true, content: token.text + "\n" });
  } else if (token.type === "paragraph") {
    return (0, import_koishi.h)("p", render(token.tokens));
  } else if (token.type === "image") {
    return import_koishi.h.image(token.href);
  } else if (token.type === "blockquote") {
    return (0, import_koishi.h)("text", { content: token.text + "\n" });
  } else if (token.type === "text") {
    return (0, import_koishi.h)("text", { content: token.text });
  } else if (token.type === "em") {
    return (0, import_koishi.h)("em", render(token.tokens));
  } else if (token.type === "strong") {
    return (0, import_koishi.h)("strong", render(token.tokens));
  } else if (token.type === "del") {
    return (0, import_koishi.h)("del", render(token.tokens));
  } else if (token.type === "link") {
    return (0, import_koishi.h)("a", { href: token.href }, render(token.tokens));
  } else if (token.type === "html") {
    const cap = tagRegExp.exec(token.text);
    if (!cap) {
      return (0, import_koishi.h)("text", { content: token.text });
    }
    if (cap[2] === "img") {
      if (cap[1]) return;
      const src = cap[3].match(/src="([^"]+)"/);
      if (src) return import_koishi.h.image(src[1]);
    }
  }
  return (0, import_koishi.h)("text", { content: token.raw });
}
__name(renderToken, "renderToken");
function render(tokens) {
  return tokens.map(renderToken).filter(Boolean);
}
__name(render, "render");
function transform(source, ...args) {
  if (!source) return [];
  if (Array.isArray(source)) {
    source = args.map((arg, index) => source[index] + arg).join("") + source[args.length];
  }
  return render(import_marked.marked.lexer(source));
}
__name(transform, "transform");
var logger;
function setLogger(setLogger2) {
  logger = setLogger2;
}
__name(setLogger, "setLogger");

// src/plugins/chat.ts
var import_string2 = require("koishi-plugin-chatluna/utils/string");
var logger2;
async function initializeModel(ctx, platform, modelName) {
  return await ctx.chatluna.createChatModel(platform, modelName);
}
__name(initializeModel, "initializeModel");
async function setupModelPool(ctx, config) {
  const [platform, modelName] = (0, import_count_tokens2.parseRawModelName)(config.model);
  const globalModel = await initializeModel(ctx, platform, modelName);
  logger2.info("global model loaded %c", config.model);
  const modelPool = {};
  if (config.modelOverride?.length > 0) {
    for (const override of config.modelOverride) {
      modelPool[override.groupId] = (async () => {
        const [platform2, modelName2] = (0, import_count_tokens2.parseRawModelName)(override.model);
        const loadedModel = await initializeModel(
          ctx,
          platform2,
          modelName2
        );
        logger2.info(
          "override model loaded %c for group %c",
          override.model,
          override.groupId
        );
        modelPool[override.groupId] = Promise.resolve(loadedModel);
        return loadedModel;
      })();
    }
  }
  return { globalModel, modelPool };
}
__name(setupModelPool, "setupModelPool");
async function getModelForGuild(guildId, globalModel, modelPool) {
  return await (modelPool[guildId] ?? Promise.resolve(globalModel));
}
__name(getModelForGuild, "getModelForGuild");
async function getConfigAndPresetForGuild(guildId, config, globalPreset, presetPool, preset) {
  const currentGuildConfig = config.configs[guildId];
  let copyOfConfig = { ...config };
  let currentPreset = globalPreset;
  if (currentGuildConfig) {
    copyOfConfig = Object.assign({}, copyOfConfig, currentGuildConfig);
    currentPreset = presetPool[guildId] ?? await (async () => {
      const template = preset.getPresetForCache(
        currentGuildConfig.preset
      );
      presetPool[guildId] = template;
      return template;
    })();
    logger2.debug(
      `override config: ${JSON.stringify(copyOfConfig)} for guild ${guildId}`
    );
  }
  return { copyOfConfig, currentPreset };
}
__name(getConfigAndPresetForGuild, "getConfigAndPresetForGuild");
async function prepareMessages(messages, config, session, model, currentPreset, temp, chain, focusMessage) {
  const [recentMessage, lastMessage] = await formatMessage(
    messages,
    config,
    model,
    currentPreset.system.rawString,
    currentPreset.input.rawString,
    focusMessage
  );
  const formattedSystemPrompt = await currentPreset.system.format(
    {
      time: "",
      stickers: "",
      status: ""
    },
    session.app.chatluna.promptRenderer,
    {
      session
    }
  );
  if (!chain) {
    logger2.debug("messages_new: " + JSON.stringify(recentMessage));
    logger2.debug("messages_last: " + JSON.stringify(lastMessage));
  }
  const humanMessage = new import_messages2.HumanMessage(
    await currentPreset.input.format(
      {
        history_new: recentMessage.join("\n\n").replaceAll("{", "{{").replaceAll("}", "}}"),
        history_last: lastMessage.replaceAll("{", "{{").replaceAll("}", "}}"),
        time: formatTimestamp(/* @__PURE__ */ new Date()),
        stickers: "",
        // JSON.stringify(stickerService.getAllStickTypes()),
        status: temp.status ?? currentPreset.status ?? "",
        prompt: session.content,
        built: {
          preset: currentPreset.name,
          conversationId: session.guildId
        }
      },
      session.app.chatluna.promptRenderer,
      {
        session
      }
    )
  );
  const tempMessages = [];
  if (config.image) {
    for (const message of messages) {
      if (message.images && message.images.length > 0) {
        const imageMessage = new import_messages2.HumanMessage({
          content: message.images.flatMap((image) => [
            { type: "text", text: image.formatted },
            { type: "image_url", image_url: image.url }
          ])
        });
        tempMessages.push(imageMessage);
      }
    }
  }
  return formatCompletionMessages(
    [new import_messages2.SystemMessage(formattedSystemPrompt)].concat(
      temp.completionMessages
    ),
    tempMessages,
    humanMessage,
    config,
    model
  );
}
__name(prepareMessages, "prepareMessages");
async function getModelResponse(ctx, session, model, completionMessages, config, chain) {
  for (let retryCount = 0; retryCount < 2; retryCount++) {
    try {
      const lastMessage = completionMessages[completionMessages.length - 1];
      const historyMessages = completionMessages.slice(0, -1);
      const systemMessage = chain != null ? historyMessages.shift() : void 0;
      const responseMessage = chain ? await chain.invoke(
        {
          instructions: (0, import_string2.getMessageContent)(
            systemMessage.content
          ),
          chat_history: historyMessages,
          input: lastMessage
        },
        {
          configurable: {
            session,
            model,
            userId: session.userId,
            conversationId: session.guildId
          }
        }
      ) : await model.invoke(completionMessages);
      logger2.debug("model response: " + responseMessage.content);
      const parsedResponse = await parseResponse(
        responseMessage.content,
        config.isAt,
        async (element) => {
          logger2.debug(
            "voice render element: " + JSON.stringify(element)
          );
          try {
            const content = element.attrs["content"];
            const extra = element.attrs["extra"];
            if (extra) {
              const { id } = extra;
              if (id) {
                return [
                  await ctx.vits.say(
                    Object.assign(
                      {
                        speaker_id: parseInt(id),
                        input: content
                      },
                      { session }
                    )
                  )
                ];
              }
            }
            return [
              await ctx.vits.say(
                Object.assign({ input: content }, { session })
              )
            ];
          } catch (e) {
            logger2.error("voice render failed", e);
            return [element];
          }
        },
        config
      );
      return { responseMessage, parsedResponse };
    } catch (e) {
      logger2.error("model requests failed", e);
      if (retryCount === 1) return null;
      await (0, import_koishi2.sleep)(3e3);
    }
  }
  return null;
}
__name(getModelResponse, "getModelResponse");
function calculateMessageDelay(text, elements, typingTime) {
  let maxTime = text.length * typingTime + 100;
  if (elements.length === 1 && elements[0].attrs["code"] === true) {
    maxTime *= 0.1;
  }
  return maxTime;
}
__name(calculateMessageDelay, "calculateMessageDelay");
async function handleVoiceMessage(session, ctx, text, elements) {
  try {
    await session.send(
      await ctx.vits.say(Object.assign({ input: text }, { session }))
    );
    return true;
  } catch (e) {
    logger2.error(e);
    await session.send(elements);
    return false;
  }
}
__name(handleVoiceMessage, "handleVoiceMessage");
async function handleMessageSending(session, elements, text, parsedResponse, config, ctx, maxTime, emoticonStatement, breakSay) {
  const isVoice = parsedResponse.messageType === "voice";
  if (isVoice && emoticonStatement !== "text") {
    return false;
  }
  const random = new import_koishi2.Random();
  if (config.splitVoice !== true && isVoice && !breakSay) {
    const fullMaxTime = parsedResponse.rawMessage.length * config.typingTime + 100;
    await (0, import_koishi2.sleep)(random.int(fullMaxTime / 4, fullMaxTime / 2));
    return handleVoiceMessage(
      session,
      ctx,
      parsedResponse.rawMessage,
      elements
    );
  }
  if (emoticonStatement !== "span") {
    await (0, import_koishi2.sleep)(random.int(maxTime / 2, maxTime));
  } else {
    await (0, import_koishi2.sleep)(random.int(maxTime / 12, maxTime / 4));
  }
  try {
    switch (parsedResponse.messageType) {
      case "text":
        await session.send(elements);
        break;
      case "voice":
        await session.send(
          await ctx.vits.say(
            Object.assign({ input: text }, { session })
          )
        );
        break;
      default:
        await session.send(elements);
        break;
    }
  } catch (e) {
    logger2.error(e);
    await session.send(elements);
  }
  return false;
}
__name(handleMessageSending, "handleMessageSending");
async function handleModelResponse(session, config, ctx, parsedResponse) {
  let breakSay = false;
  for (const elements of parsedResponse.elements) {
    const text = elements.map((element) => element.attrs.content ?? "").join("");
    const emoticonStatement = isEmoticonStatement(text, elements);
    if (elements.length < 1) continue;
    const maxTime = text.length > config.largeTextSize ? config.largeTextTypingTime : calculateMessageDelay(text, elements, config.typingTime);
    breakSay = await handleMessageSending(
      session,
      elements,
      text,
      parsedResponse,
      config,
      ctx,
      maxTime,
      emoticonStatement,
      breakSay
    );
    if (breakSay) {
      break;
    }
  }
  await ctx.chatluna_character.broadcastOnBot(
    session,
    parsedResponse.elements.flat()
  );
}
__name(handleModelResponse, "handleModelResponse");
async function apply(ctx, config) {
  const service = ctx.chatluna_character;
  const preset = service.preset;
  logger2 = service.logger;
  setLogger(logger2);
  const { globalModel, modelPool } = await setupModelPool(ctx, config);
  let globalPreset = preset.getPresetForCache(config.defaultPreset);
  let presetPool = {};
  const chainPool = {};
  ctx.on("chatluna_character/preset_updated", () => {
    globalPreset = preset.getPresetForCache(config.defaultPreset);
    presetPool = {};
  });
  service.collect(async (session, messages) => {
    const guildId = session.event.guild?.id ?? session.guildId;
    try {
      const model = await getModelForGuild(
        guildId,
        globalModel,
        modelPool
      );
      const { copyOfConfig, currentPreset } = await getConfigAndPresetForGuild(
        guildId,
        config,
        globalPreset,
        presetPool,
        preset
      );
      if (model.value == null) {
        logger2.warn(
          `Model ${copyOfConfig.model} load not successful. Please check your logs output.`
        );
        return;
      }
      if (copyOfConfig.toolCalling) {
        chainPool[guildId] = chainPool[guildId] ?? await createChatLunaChain(ctx, model, session);
      }
      const temp = await service.getTemp(session);
      const latestMessages = service.getMessages(guildId) ?? messages;
      const focusMessage = latestMessages[latestMessages.length - 1];
      const completionMessages = await prepareMessages(
        latestMessages,
        copyOfConfig,
        session,
        model.value,
        currentPreset,
        temp,
        chainPool[guildId]?.value,
        focusMessage
      );
      if (!chainPool[guildId]) {
        logger2.debug(
          "completion message: " + JSON.stringify(
            completionMessages.map((it) => it.content)
          )
        );
      }
      const response = await getModelResponse(
        ctx,
        session,
        model.value,
        completionMessages,
        copyOfConfig,
        chainPool[guildId]?.value
      );
      if (!response) return;
      const { responseMessage, parsedResponse } = response;
      temp.status = parsedResponse.status;
      if (parsedResponse.elements.length < 1) {
        service.mute(session, copyOfConfig.muteTime);
        return;
      }
      temp.completionMessages.push(
        completionMessages[completionMessages.length - 1]
      );
      temp.completionMessages.push(responseMessage);
      trimCompletionMessages(
        temp.completionMessages,
        copyOfConfig.modelCompletionCount
      );
      await handleModelResponse(
        session,
        copyOfConfig,
        ctx,
        parsedResponse
      );
      service.muteAtLeast(session, copyOfConfig.coolDownTime * 1e3);
    } catch (e) {
      logger2.error(e);
    } finally {
      service.releaseResponseLock(session);
    }
  });
}
__name(apply, "apply");

// src/plugins/filter.ts
var import_koishi3 = require("koishi");
var groupInfos = {};
var WINDOW_SIZE = 90;
var RECENT_WINDOW = import_koishi3.Time.second * 90;
var SHORT_BURST_WINDOW = import_koishi3.Time.second * 30;
var INSTANT_WINDOW = import_koishi3.Time.second * 20;
var MIN_COOLDOWN_TIME = import_koishi3.Time.second * 6;
var COOLDOWN_PENALTY = 0.8;
var THRESHOLD_RESET_TIME = import_koishi3.Time.minute * 10;
var MIN_RECENT_MESSAGES = 6;
var SUSTAINED_RATE_THRESHOLD = 10;
var SUSTAINED_RATE_SCALE = 3;
var INSTANT_RATE_THRESHOLD = 9;
var INSTANT_RATE_SCALE = 2;
var BURST_RATE_THRESHOLD = 12;
var BURST_RATE_SCALE = 4;
var SMOOTHING_WINDOW = import_koishi3.Time.second * 8;
var FRESHNESS_HALF_LIFE = import_koishi3.Time.second * 60;
async function apply2(ctx, config) {
  const service = ctx.chatluna_character;
  const preset = service.preset;
  const logger3 = service.logger;
  const globalPreset = await preset.getPreset(config.defaultPreset);
  const presetPool = {};
  ctx.on("guild-member", (session) => {
    if (!config.applyGroup.includes(session.guildId) || session.event?.subtype !== "ban" || session.bot.selfId !== session.event?.user?.id) {
      return;
    }
    const duration = (session.event._data?.["duration"] ?? 0) * 1e3;
    if (duration === 0) {
      logger3.warn(
        `检测到 ${session.bot.user?.name || session.selfId} 被 ${session.operatorId} 操作解禁。`
      );
      ctx.chatluna_character.mute(session, 0);
      return;
    }
    logger3.warn(
      `检测到 ${session.bot.user?.name || session.selfId} 被 ${session.operatorId} 操作禁言 ${duration / 1e3} 秒。`
    );
    ctx.chatluna_character.mute(session, duration);
  });
  service.addFilter((session, message) => {
    const guildId = session.guildId;
    const now = Date.now();
    const currentGuildConfig = config.configs[guildId];
    let copyOfConfig = Object.assign({}, config);
    let currentPreset = globalPreset;
    if (currentGuildConfig != null) {
      copyOfConfig = Object.assign({}, copyOfConfig, currentGuildConfig);
      currentPreset = presetPool[guildId] ?? (() => {
        const template = preset.getPresetForCache(
          currentGuildConfig.preset
        );
        presetPool[guildId] = template;
        return template;
      })();
    }
    const info = groupInfos[guildId] ?? {
      messageCount: 0,
      messageTimestamps: [],
      lastActivityScore: 0,
      lastScoreUpdate: 0,
      lastResponseTime: 0,
      currentActivityThreshold: copyOfConfig.messageActivityScoreLowerLimit,
      lastUserMessageTime: now
    };
    info.messageTimestamps.push(now);
    if (info.messageTimestamps.length > WINDOW_SIZE) {
      info.messageTimestamps.shift();
    }
    if (now - info.lastUserMessageTime >= THRESHOLD_RESET_TIME) {
      info.currentActivityThreshold = copyOfConfig.messageActivityScoreLowerLimit;
    }
    info.lastUserMessageTime = now;
    const activity = calculateActivityScore(
      info.messageTimestamps,
      info.lastResponseTime,
      copyOfConfig.maxMessages,
      info.lastActivityScore,
      info.lastScoreUpdate
    );
    info.lastActivityScore = activity.score;
    info.lastScoreUpdate = activity.timestamp;
    logger3.debug(
      `messageCount: ${info.messageCount}, activityScore: ${activity.score.toFixed(3)}. content: ${JSON.stringify(
        Object.assign({}, message, { images: void 0 })
      )}`
    );
    if (copyOfConfig.disableChatLuna && copyOfConfig.whiteListDisableChatLuna.includes(guildId)) {
      const selfId = session.bot.userId ?? session.bot.selfId ?? "0";
      const guildMessages = ctx.chatluna_character.getMessages(guildId);
      let maxRecentMessage = 0;
      if (guildMessages == null || guildMessages.length === 0) {
        maxRecentMessage = 6;
      }
      while (maxRecentMessage < 5) {
        const currentMessage = guildMessages[guildMessages?.length - 1 - maxRecentMessage];
        if (currentMessage == null) {
          return false;
        }
        if (currentMessage.id === selfId) {
          break;
        }
        maxRecentMessage++;
      }
    }
    let appel = session.stripped.appel;
    const botId = session.bot.selfId;
    if (!appel) {
      appel = session.elements.some(
        (element) => element.type === "at" && element.attrs?.["id"] === botId
      );
    }
    if (!appel) {
      appel = session.quote?.user?.id === botId;
    }
    const isAppel = Boolean(appel);
    const muteKeywords = currentPreset.mute_keyword ?? [];
    const forceMuteActive = copyOfConfig.isForceMute && isAppel && muteKeywords.length > 0;
    const needPlainText = copyOfConfig.isNickname || copyOfConfig.isNickNameWithContent || forceMuteActive;
    const plainTextContent = needPlainText ? (session.elements ?? []).filter((element) => element.type === "text").map((element) => element.attrs?.content ?? "").join("") : "";
    if (forceMuteActive) {
      const needMute = muteKeywords.some(
        (value) => plainTextContent.includes(value)
      );
      if (needMute) {
        logger3.debug(`mute content: ${message.content}`);
        service.mute(session, config.muteTime);
      }
    }
    const isMute = service.isMute(session);
    const isDirectTrigger = isAppel || copyOfConfig.isNickname && currentPreset.nick_name.some(
      (value) => plainTextContent.startsWith(value)
    ) || copyOfConfig.isNickNameWithContent && currentPreset.nick_name.some(
      (value) => plainTextContent.includes(value)
    );
    const shouldRespond = info.messageCount > copyOfConfig.messageInterval || isDirectTrigger || info.lastActivityScore >= info.currentActivityThreshold;
    if (shouldRespond && !isMute) {
      info.messageCount = 0;
      info.lastActivityScore = Math.max(
        0,
        info.lastActivityScore - COOLDOWN_PENALTY
      );
      info.lastResponseTime = now;
      const lowerLimit = copyOfConfig.messageActivityScoreLowerLimit;
      const upperLimit = copyOfConfig.messageActivityScoreUpperLimit;
      const step = (upperLimit - lowerLimit) * 0.1;
      info.currentActivityThreshold = Math.max(
        Math.min(
          info.currentActivityThreshold + step,
          Math.max(lowerLimit, upperLimit)
        ),
        Math.min(lowerLimit, upperLimit)
      );
      groupInfos[session.guildId] = info;
      return true;
    }
    info.messageCount++;
    groupInfos[session.guildId] = info;
    return false;
  });
}
__name(apply2, "apply");
function logistic(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value > 10) return 0.99995;
  if (value < -10) return 5e-5;
  return 1 / (1 + Math.exp(-value));
}
__name(logistic, "logistic");
function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}
__name(clamp, "clamp");
function calculateFreshnessFactor(timestamps) {
  if (timestamps.length === 0) return 0;
  const now = Date.now();
  const lastMessageTime = timestamps[timestamps.length - 1];
  const timeSinceLastMessage = now - lastMessageTime;
  return Math.exp(-timeSinceLastMessage / FRESHNESS_HALF_LIFE);
}
__name(calculateFreshnessFactor, "calculateFreshnessFactor");
function smoothScore(targetScore, previousScore, previousTimestamp, now) {
  if (!previousTimestamp || previousTimestamp <= 0) {
    return targetScore;
  }
  const elapsed = now - previousTimestamp;
  if (elapsed <= 0) {
    return targetScore;
  }
  const smoothingFactor = 1 - Math.exp(-elapsed / SMOOTHING_WINDOW);
  return previousScore + (targetScore - previousScore) * clamp(smoothingFactor, 0, 1);
}
__name(smoothScore, "smoothScore");
function calculateActivityScore(timestamps, lastResponseTime, maxMessages, previousScore, previousTimestamp) {
  const now = Date.now();
  if (timestamps.length < 2) {
    const score = smoothScore(0, previousScore, previousTimestamp, now);
    return { score, timestamp: now };
  }
  const recentMessages = timestamps.filter((ts) => now - ts <= RECENT_WINDOW);
  if (recentMessages.length < MIN_RECENT_MESSAGES) {
    const score = smoothScore(0, previousScore, previousTimestamp, now);
    return { score, timestamp: now };
  }
  const sustainedRate = recentMessages.length / RECENT_WINDOW * import_koishi3.Time.minute;
  const instantMessages = timestamps.filter(
    (ts) => now - ts <= INSTANT_WINDOW
  );
  const instantRate = instantMessages.length / INSTANT_WINDOW * import_koishi3.Time.minute;
  const burstMessages = timestamps.filter(
    (ts) => now - ts <= SHORT_BURST_WINDOW
  );
  const burstRate = burstMessages.length / SHORT_BURST_WINDOW * import_koishi3.Time.minute;
  const sustainedComponent = logistic(
    (sustainedRate - SUSTAINED_RATE_THRESHOLD) / SUSTAINED_RATE_SCALE
  );
  const instantComponent = logistic(
    (instantRate - INSTANT_RATE_THRESHOLD) / INSTANT_RATE_SCALE
  );
  let combinedScore = sustainedComponent * 0.65 + instantComponent * 0.35;
  if (burstRate > BURST_RATE_THRESHOLD) {
    const burstContribution = clamp(
      (burstRate - BURST_RATE_THRESHOLD) / BURST_RATE_SCALE,
      0,
      1
    );
    combinedScore += burstContribution * 0.25;
  }
  if (instantMessages.length >= 6) {
    const startIndex = Math.max(
      timestamps.length - instantMessages.length,
      0
    );
    const relevant = timestamps.slice(startIndex);
    const intervals = [];
    for (let i = 1; i < relevant.length; i++) {
      intervals.push(relevant[i] - relevant[i - 1]);
    }
    if (intervals.length > 0) {
      const averageGap = intervals.reduce((total, value) => total + value, 0) / intervals.length;
      const intervalComponent = logistic(
        (import_koishi3.Time.second * 12 - averageGap) / (import_koishi3.Time.second * 6)
      );
      combinedScore *= 0.7 + 0.3 * intervalComponent;
    }
  }
  const freshnessFactor = calculateFreshnessFactor(timestamps);
  combinedScore *= 0.55 + 0.45 * freshnessFactor;
  if (maxMessages && recentMessages.length >= maxMessages * 0.9) {
    combinedScore += 0.08;
  }
  if (lastResponseTime) {
    const timeSinceLastResponse = now - lastResponseTime;
    if (timeSinceLastResponse < MIN_COOLDOWN_TIME) {
      const cooldownRatio = timeSinceLastResponse / MIN_COOLDOWN_TIME;
      combinedScore *= cooldownRatio * cooldownRatio;
    }
  }
  const smoothedScore = smoothScore(
    clamp(combinedScore, 0, 1),
    previousScore,
    previousTimestamp,
    now
  );
  return { score: clamp(smoothedScore, 0, 1), timestamp: now };
}
__name(calculateActivityScore, "calculateActivityScore");

// src/plugins/commands.ts
function apply3(ctx, config) {
  ctx.command("chatluna.character", "角色扮演相关命令");
  ctx.command("chatluna.character.clear [group]", "清除群组的聊天记录", {
    authority: 3
  }).action(async ({ session }, group) => {
    const groupId = group ?? session.guildId;
    if (!groupId) {
      await sendMessageToPrivate(session, "请检查你是否提供了群组 id");
      return;
    }
    const groupInfo = groupInfos[groupId];
    if (!groupInfo) {
      await sendMessageToPrivate(session, "未找到该群组的聊天记录");
      return;
    }
    groupInfos[groupId] = {
      messageCount: 0,
      messageTimestamps: [],
      lastActivityScore: 0,
      currentActivityThreshold: 0,
      lastUserMessageTime: 0,
      lastScoreUpdate: Date.now(),
      lastResponseTime: 0
    };
    await ctx.chatluna_character.clear(groupId);
    await sendMessageToPrivate(session, `已清除群组 ${groupId} 的聊天记录`);
  });
}
__name(apply3, "apply");
async function sendMessageToPrivate(session, message) {
  await session.bot.sendPrivateMessage(session.userId, message);
}
__name(sendMessageToPrivate, "sendMessageToPrivate");

// src/plugins/config.ts
var import_schema = require("koishi-plugin-chatluna/utils/schema");
async function apply4(ctx, config) {
  (0, import_schema.modelSchema)(ctx);
}
__name(apply4, "apply");

// src/plugins/interception.ts
function apply5(ctx, config) {
  ctx.on("chatluna/before-check-sender", async (session) => {
    const guildId = session.guildId;
    if (!config.applyGroup.includes(guildId) || session.isDirect) {
      return false;
    }
    let appel = session.stripped.appel;
    const botId = session.bot.userId;
    if (!appel) {
      appel = session.elements.some(
        (element) => element.type === "at" && element.attrs?.["id"] === botId
      );
    }
    if (!appel) {
      const botId2 = session.bot.userId;
      appel = session.quote?.user?.id === botId2;
    }
    if (!appel) {
      return config.disableChatLuna;
    }
    if (config.disableChatLuna && config.whiteListDisableChatLuna?.includes(guildId)) {
      const selfId = session.bot.userId ?? session.bot.selfId ?? "0";
      const guildMessages = ctx.chatluna_character.getMessages(guildId);
      if (guildMessages == null || guildMessages.length === 0) {
        return true;
      }
      let maxRecentMessage = 0;
      while (maxRecentMessage < 3) {
        const currentMessage = guildMessages[guildMessages?.length - 1 - maxRecentMessage];
        if (currentMessage == null) {
          return false;
        }
        if (currentMessage.id === selfId) {
          return true;
        }
        maxRecentMessage++;
      }
    }
    return config.disableChatLuna;
  });
}
__name(apply5, "apply");

// src/plugin.ts
async function plugins(ctx, parent) {
  const middlewares = (
    // middleware start
    [apply, apply3, apply4, apply2, apply5]
  );
  for (const middleware of middlewares) {
    await middleware(ctx, parent);
  }
}
__name(plugins, "plugins");

// src/service/message.ts
var import_koishi5 = require("koishi");
var import_logger = require("koishi-plugin-chatluna/utils/logger");

// src/preset.ts
var import_promises = __toESM(require("fs/promises"), 1);
var import_js_yaml = require("js-yaml");
var import_koishi4 = require("koishi");
var import_error = require("koishi-plugin-chatluna/utils/error");
var import_path = __toESM(require("path"), 1);
var import_url = require("url");
var import_fs = require("fs");
var import_meta = {};
var Preset = class {
  constructor(ctx) {
    this.ctx = ctx;
    ctx.on("dispose", () => {
      this._aborter?.abort();
    });
  }
  static {
    __name(this, "Preset");
  }
  _presets = [];
  _aborter = null;
  async loadAllPreset() {
    await this._checkPresetDir();
    const presetDir = this.resolvePresetDir();
    const files = await import_promises.default.readdir(presetDir);
    this._presets.length = 0;
    for (const file of files) {
      try {
        const extension = import_path.default.extname(file);
        if (extension !== ".yml") {
          continue;
        }
        const rawText = await import_promises.default.readFile(
          import_path.default.join(presetDir, file),
          "utf-8"
        );
        const preset = loadPreset(rawText);
        preset.path = import_path.default.join(presetDir, file);
        this._presets.push(preset);
      } catch (e) {
        this.ctx.chatluna_character.logger.error(
          `error when load ${file}`,
          e
        );
      }
    }
    this.ctx.schema.set(
      "character-preset",
      import_koishi4.Schema.union(
        this._presets.map((preset) => preset.name).concat("无").map((name2) => import_koishi4.Schema.const(name2))
      )
    );
    this.ctx.emit("chatluna_character/preset_updated");
  }
  async getPreset(triggerKeyword, loadForDisk = true, throwError = true) {
    if (loadForDisk) {
      await this.loadAllPreset();
    }
    return this.getPresetForCache(triggerKeyword, throwError);
  }
  watchPreset() {
    let fsWait = false;
    if (this._aborter != null) {
      this._aborter.abort();
    }
    this._aborter = new AbortController();
    (0, import_fs.watch)(
      this.resolvePresetDir(),
      {
        signal: this._aborter.signal
      },
      async (event, filename) => {
        if (filename) {
          if (fsWait) return;
          fsWait = setTimeout(() => {
            fsWait = false;
          }, 100);
          await this.loadAllPreset();
          this.ctx.chatluna_character.logger.debug(
            `trigger full reload preset by ${filename}`
          );
          return;
        }
        await this.loadAllPreset();
        this.ctx.chatluna_character.logger.debug(
          `trigger full reload preset`
        );
      }
    );
  }
  async init() {
    await this.loadAllPreset();
    this.watchPreset();
  }
  getPresetForCache(triggerKeyword, throwError = true) {
    const preset = this._presets.find(
      (preset2) => preset2.name === triggerKeyword
    );
    if (preset) {
      return preset;
    }
    if (throwError) {
      throw new import_error.ChatLunaError(
        import_error.ChatLunaErrorCode.PRESET_NOT_FOUND,
        new Error(`No preset found for keyword ${triggerKeyword}`)
      );
    }
    return void 0;
  }
  async getDefaultPreset() {
    if (this._presets.length === 0) {
      await this.loadAllPreset();
    }
    const preset = this._presets.find((preset2) => preset2.name === "默认");
    if (preset) {
      return preset;
    } else {
      await this._copyDefaultPresets();
      return this.getDefaultPreset();
    }
  }
  async getAllPreset() {
    await this.loadAllPreset();
    return this._presets.map((preset) => preset.name);
  }
  async resetDefaultPreset() {
    await this._copyDefaultPresets();
  }
  resolvePresetDir() {
    return import_path.default.resolve(this.ctx.baseDir, "data/chathub/character/presets");
  }
  async _checkPresetDir() {
    const presetDir = import_path.default.join(this.resolvePresetDir());
    try {
      await import_promises.default.access(presetDir);
    } catch (err) {
      if (err.code === "ENOENT") {
        await import_promises.default.mkdir(presetDir, { recursive: true });
        await this._copyDefaultPresets();
      } else {
        throw err;
      }
    }
  }
  async _copyDefaultPresets() {
    const currentPresetDir = import_path.default.join(this.resolvePresetDir());
    const dirname = __dirname?.length > 0 ? __dirname : (0, import_url.fileURLToPath)(import_meta.url);
    const defaultPresetDir = import_path.default.join(dirname, "../resources/presets");
    const files = await import_promises.default.readdir(defaultPresetDir);
    for (const file of files) {
      const filePath = import_path.default.join(defaultPresetDir, file);
      const fileStat = await import_promises.default.stat(filePath);
      if (fileStat.isFile()) {
        await import_promises.default.mkdir(currentPresetDir, { recursive: true });
        this.ctx.chatluna_character.logger.debug(
          `copy preset file ${filePath} to ${currentPresetDir}`
        );
        await import_promises.default.copyFile(filePath, import_path.default.join(currentPresetDir, file));
      }
    }
  }
};
function loadPreset(text) {
  const rawPreset = (0, import_js_yaml.load)(text);
  let input;
  let system;
  try {
    input = {
      rawString: rawPreset.input,
      format: /* @__PURE__ */ __name(async (variables, variableService, configurable) => {
        return await variableService.renderTemplate(rawPreset.input, variables, {
          configurable
        }).then((result) => result.text);
      }, "format")
    };
  } catch (e) {
    throw new import_error.ChatLunaError(
      import_error.ChatLunaErrorCode.PRESET_LOAD_ERROR,
      new Error(`input format error: ${rawPreset.input} in ${rawPreset}`)
    );
  }
  try {
    system = {
      rawString: rawPreset.system,
      format: /* @__PURE__ */ __name(async (variables, variableService, configurable) => {
        return await variableService.renderTemplate(rawPreset.system, variables, {
          configurable
        }).then((result) => result.text);
      }, "format")
    };
  } catch (e) {
    throw new import_error.ChatLunaError(
      import_error.ChatLunaErrorCode.PRESET_LOAD_ERROR,
      new Error(
        `system format error: ${rawPreset.system} in ${rawPreset}`
      )
    );
  }
  return {
    name: rawPreset.name,
    nick_name: rawPreset.nick_name,
    input,
    system,
    mute_keyword: rawPreset.mute_keyword ?? [],
    status: rawPreset?.status
  };
}
__name(loadPreset, "loadPreset");

// src/service/message.ts
var import_string3 = require("koishi-plugin-chatluna/utils/string");
var MessageCollector = class extends import_koishi5.Service {
  constructor(ctx, _config) {
    super(ctx, "chatluna_character");
    this.ctx = ctx;
    this._config = _config;
    this.logger = (0, import_logger.createLogger)(ctx, "chatluna-character");
    this.preset = new Preset(ctx);
  }
  static {
    __name(this, "MessageCollector");
  }
  _messages = {};
  _filters = [];
  _groupLocks = {};
  _groupTemp = {};
  _responseWaiters = {};
  preset;
  addFilter(filter) {
    this._filters.push(filter);
  }
  mute(session, time) {
    const lock = this._getGroupLocks(session.guildId);
    let mute = lock.mute ?? 0;
    if (time === 0) {
      mute = 0;
    } else if (mute < (/* @__PURE__ */ new Date()).getTime()) {
      mute = (/* @__PURE__ */ new Date()).getTime() + time;
    } else {
      mute = mute + time;
    }
    lock.mute = mute;
  }
  async muteAtLeast(session, time) {
    const groupId = session.guildId;
    await this._lockByGroupId(groupId);
    try {
      const groupLock = this._getGroupLocks(groupId);
      groupLock.mute = Math.max(groupLock.mute ?? 0, Date.now() + time);
    } finally {
      this._unlockByGroupId(groupId);
    }
  }
  collect(func) {
    this.ctx.on("chatluna_character/message_collect", func);
  }
  getMessages(groupId) {
    return this._messages[groupId];
  }
  isMute(session) {
    const lock = this._getGroupLocks(session.guildId);
    return lock.mute > (/* @__PURE__ */ new Date()).getTime();
  }
  isResponseLocked(session) {
    const lock = this._getGroupLocks(session.guildId);
    return lock.responseLock;
  }
  /**
   * Try to acquire the response lock. If the lock is already held, wait until it is released.
   * @returns A Promise that resolves to whether the lock was successfully acquired (false means cancelled)
   */
  async acquireResponseLock(session, message) {
    const groupId = session.guildId;
    await this._lockByGroupId(groupId);
    const lock = this._getGroupLocks(groupId);
    if (!lock.responseLock) {
      lock.responseLock = true;
      this._unlockByGroupId(groupId);
      return true;
    }
    const waiterPromise = new Promise((resolve) => {
      if (!this._responseWaiters[groupId]) {
        this._responseWaiters[groupId] = [];
      }
      this._responseWaiters[groupId].push({
        resolve: /* @__PURE__ */ __name(() => resolve(true), "resolve"),
        reject: /* @__PURE__ */ __name(() => resolve(false), "reject")
      });
    });
    this._unlockByGroupId(groupId);
    return waiterPromise;
  }
  setResponseLock(session) {
    const lock = this._getGroupLocks(session.guildId);
    lock.responseLock = true;
  }
  async releaseResponseLock(session) {
    const groupId = session.guildId;
    await this._lockByGroupId(groupId);
    try {
      const lock = this._getGroupLocks(groupId);
      lock.responseLock = false;
      const waiters = this._responseWaiters[groupId];
      if (waiters && waiters.length > 0) {
        const latestWaiter = waiters.pop();
        for (const waiter of waiters) {
          waiter.reject();
        }
        this._responseWaiters[groupId] = [];
        if (latestWaiter) {
          lock.responseLock = true;
          latestWaiter.resolve();
        }
      }
    } finally {
      this._unlockByGroupId(groupId);
    }
  }
  async cancelPendingWaiters(groupId) {
    await this._lockByGroupId(groupId);
    try {
      const waiters = this._responseWaiters[groupId];
      if (waiters) {
        for (const waiter of waiters) {
          waiter.reject("cancelled");
        }
        this._responseWaiters[groupId] = [];
      }
    } finally {
      this._unlockByGroupId(groupId);
    }
  }
  async updateTemp(session, temp) {
    await this._lock(session);
    const groupId = session.guildId;
    this._groupTemp[groupId] = temp;
    await this._unlock(session);
  }
  async getTemp(session) {
    await this._lock(session);
    const groupId = session.guildId;
    const temp = this._groupTemp[groupId] ?? {
      completionMessages: []
    };
    this._groupTemp[groupId] = temp;
    await this._unlock(session);
    return temp;
  }
  _getGroupLocks(groupId) {
    if (!this._groupLocks[groupId]) {
      this._groupLocks[groupId] = {
        lock: false,
        mute: 0,
        responseLock: false
      };
    }
    return this._groupLocks[groupId];
  }
  _getGroupConfig(groupId) {
    const config = this._config;
    if (!config.configs[groupId]) {
      return config;
    }
    return Object.assign({}, config, config.configs[groupId]);
  }
  _lock(session) {
    const groupLock = this._getGroupLocks(session.guildId);
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (!groupLock.lock) {
          groupLock.lock = true;
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
  }
  _unlock(session) {
    const groupLock = this._getGroupLocks(session.guildId);
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (groupLock.lock) {
          groupLock.lock = false;
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
  }
  _lockByGroupId(groupId) {
    const groupLock = this._getGroupLocks(groupId);
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (!groupLock.lock) {
          groupLock.lock = true;
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
  }
  _unlockByGroupId(groupId) {
    const groupLock = this._getGroupLocks(groupId);
    groupLock.lock = false;
  }
  async clear(groupId) {
    if (groupId) {
      await this._lockByGroupId(groupId);
      try {
        this._messages[groupId] = [];
        this._groupTemp[groupId] = {
          completionMessages: []
        };
        const waiters = this._responseWaiters[groupId];
        if (waiters) {
          for (const waiter of waiters) {
            waiter.reject("cancelled");
          }
          this._responseWaiters[groupId] = [];
        }
      } finally {
        this._unlockByGroupId(groupId);
      }
      return;
    }
    const groupIds = Object.keys(this._groupLocks).sort();
    for (const gid of groupIds) {
      await this._lockByGroupId(gid);
    }
    try {
      this._messages = {};
      this._groupTemp = {};
      for (const gid of groupIds) {
        const waiters = this._responseWaiters[gid];
        if (waiters) {
          for (const waiter of waiters) {
            waiter.reject("cancelled");
          }
          this._responseWaiters[gid] = [];
        }
      }
    } finally {
      for (let i = groupIds.length - 1; i >= 0; i--) {
        this._unlockByGroupId(groupIds[i]);
      }
    }
  }
  async broadcastOnBot(session, elements) {
    if (session.isDirect) {
      return;
    }
    const content = mapElementToString(session, session.content, elements);
    if (content.length < 1) {
      return;
    }
    const message = {
      content,
      name: session.bot.user.name,
      id: session.bot.selfId ?? "0",
      messageId: session.messageId,
      timestamp: session.event.timestamp
    };
    await this._addMessage(session, message);
  }
  async broadcast(session) {
    if (session.isDirect) {
      return;
    }
    const groupId = session.guildId;
    const config = this._getGroupConfig(groupId);
    const images = config.image ? await getImages(this.ctx, config.model, session) : void 0;
    const elements = session.elements ? session.elements : [import_koishi5.h.text(session.content)];
    const content = mapElementToString(
      session,
      session.content,
      elements,
      images
    );
    if (content.length < 1) {
      return;
    }
    const message = {
      content,
      name: getNotEmptyString(
        session.author?.nick,
        session.author?.name,
        session.event.user?.name,
        session.username
      ),
      id: session.author.id,
      messageId: session.messageId,
      timestamp: session.event.timestamp,
      quote: session.quote ? {
        content: mapElementToString(
          session,
          session.quote.content,
          session.quote.elements ?? [
            import_koishi5.h.text(session.quote.content)
          ]
        ),
        name: session.quote?.user?.name,
        id: session.quote?.user?.id,
        messageId: session.quote.id
      } : void 0,
      images
    };
    const shouldTrigger = await this._addMessage(session, message, {
      filterExpiredMessages: true,
      processImages: config
    });
    if (shouldTrigger && !this.isMute(session)) {
      const acquired = await this.acquireResponseLock(session, message);
      if (!acquired) {
        return false;
      }
      await this.ctx.parallel(
        "chatluna_character/message_collect",
        session,
        this._messages[groupId]
      );
      return true;
    } else {
      return this.isMute(session);
    }
  }
  async _addMessage(session, message, options) {
    await this._lock(session);
    try {
      const groupId = session.guildId;
      const maxMessageSize = this._config.maxMessages;
      let groupArray = this._messages[groupId] ?? [];
      groupArray.push(message);
      while (groupArray.length > maxMessageSize) {
        groupArray.shift();
      }
      if (options?.filterExpiredMessages) {
        const now = Date.now();
        groupArray = groupArray.filter((msg) => {
          return msg.timestamp == null || msg.timestamp >= now - import_koishi5.Time.hour;
        });
      }
      if (options?.processImages) {
        await this._processImages(groupArray, options.processImages);
      }
      this._messages[groupId] = groupArray;
      return this._filters.some((func) => func(session, message));
    } finally {
      await this._unlock(session);
    }
  }
  async _processImages(groupArray, config) {
    if (!config.image) return;
    const maxCount = config.imageInputMaxCount || 3;
    const maxSize = config.imageInputMaxSize * 1024 * 1024 || 1024 * 1024 * 10;
    let currentCount = 0;
    let currentSize = 0;
    for (let i = groupArray.length - 1; i >= 0; i--) {
      const message = groupArray[i];
      if (!message.images || message.images.length === 0) continue;
      const validImages = [];
      for (const image of message.images) {
        const imageSize = await this._getImageSize(image.url);
        if (currentCount < maxCount && currentSize + imageSize <= maxSize) {
          validImages.push(image);
          currentCount++;
          currentSize += imageSize;
        } else {
          break;
        }
      }
      if (validImages.length === 0) {
        delete message.images;
      } else {
        message.images = validImages;
      }
      if (currentCount >= maxCount || currentSize >= maxSize) {
        for (let j = i - 1; j >= 0; j--) {
          if (groupArray[j].images) {
            delete groupArray[j].images;
          }
        }
        break;
      }
    }
  }
  async _getImageSize(base64Image) {
    try {
      if (!base64Image.startsWith("data:")) {
        const resp = await this.ctx.http.get(base64Image, {
          responseType: "arraybuffer"
        });
        return resp.byteLength;
      }
      const base64Data = base64Image.replace(
        /^data:image\/[a-z]+;base64,/,
        ""
      );
      return Math.ceil(base64Data.length * 3 / 4);
    } catch (e) {
      this.logger.error(e, base64Image);
      return 0;
    }
  }
};
function mapElementToString(session, content, elements, images) {
  const filteredBuffer = [];
  const usedImages = /* @__PURE__ */ new Set();
  for (const element of elements) {
    if (element.type === "text") {
      const content2 = element.attrs.content;
      if (content2?.trimEnd()?.length > 0) {
        filteredBuffer.push(content2);
      }
    } else if (element.type === "at") {
      let name2 = element.attrs?.name;
      if (element.attrs.id === session.bot.selfId) {
        name2 = name2 ?? session.bot.user.name ?? "0";
      }
      if (name2 == null || name2.length < 1) {
        name2 = element.attrs.id ?? "0";
      }
      filteredBuffer.push(`<at name='${name2}'>${element.attrs.id}</at>`);
    } else if (element.type === "img") {
      const imageHash = element.attrs.imageHash;
      const imageUrl = element.attrs.imageUrl;
      const matchedImage = images?.find((image) => {
        if (imageHash && image.hash === imageHash) {
          return true;
        }
        if (imageUrl && image.url === imageUrl) {
          return true;
        }
        return false;
      });
      if (imageUrl) {
        filteredBuffer.push(`<sticker>${imageUrl}</sticker>`);
      } else if (matchedImage) {
        filteredBuffer.push(matchedImage.formatted);
        usedImages.add(matchedImage.formatted);
      } else if (images && images.length > 0) {
        for (const image of images) {
          if (!usedImages.has(image.formatted)) {
            filteredBuffer.push(image.formatted);
            usedImages.add(image.formatted);
          }
        }
      } else {
        let buffer = `[image`;
        if (imageHash) {
          buffer += `:${imageHash}`;
        }
        if (imageUrl) {
          buffer += `:${imageUrl}`;
        }
        buffer += "]";
        filteredBuffer.push(buffer);
      }
    } else if (element.type === "face") {
      filteredBuffer.push(
        `<face name='${element.attrs.name}'>${element.attrs.id}</face>`
      );
    } else if (element.type === "file") {
      const url = element.attrs["chatluna_file_url"];
      if (!url) {
        continue;
      }
      const name2 = element.attrs["file"] ?? element.attrs["name"];
      filteredBuffer.push(`[file:${name2}:${url}]`);
    }
  }
  if (content.trimEnd().length < 1 && filteredBuffer.length < 1) {
    return "";
  }
  return filteredBuffer.join("");
}
__name(mapElementToString, "mapElementToString");
async function getImages(ctx, model, session) {
  const mergedMessage = await ctx.chatluna.messageTransformer.transform(
    session,
    session.elements,
    model
  );
  if (typeof mergedMessage.content === "string") {
    return void 0;
  }
  const images = mergedMessage.content.filter(import_string3.isMessageContentImageUrl);
  if (!images || images.length < 1) {
    return void 0;
  }
  const results = [];
  for (const image of images) {
    const url = typeof image.image_url === "string" ? image.image_url : image.image_url.url;
    let hash = typeof image.image_url !== "string" ? image.image_url["hash"] : "";
    if (url && !url.startsWith("http://") && !url.startsWith("https://")) {
      hash = await (0, import_string3.hashString)(url, 8);
    }
    const formatted = hash ? `[image:${hash}]` : `<sticker>${url}</sticker>`;
    results.push({ url, hash, formatted });
  }
  return results;
}
__name(getImages, "getImages");
function getNotEmptyString(...texts) {
  for (const text of texts) {
    if (text && text?.length > 0) {
      return text;
    }
  }
}
__name(getNotEmptyString, "getNotEmptyString");

// src/index.ts
function apply6(ctx, config) {
  ctx.plugin(MessageCollector, config);
  ctx.plugin(
    {
      apply: /* @__PURE__ */ __name((ctx2, config2) => {
        ctx2.on("ready", async () => {
          await ctx2.chatluna_character.preset.init();
          await plugins(ctx2, config2);
        });
      }, "apply"),
      inject: Object.assign({}, inject2, {
        chatluna_character: {
          required: true
        }
      }),
      name: "chatluna_character_entry_point"
    },
    config
  );
  ctx.middleware((session, next) => {
    if (!ctx.chatluna_character) {
      return next();
    }
    if (ctx.bots[session.uid]) {
      return next();
    }
    const guildId = session.guildId;
    if (!config.applyGroup.includes(guildId)) {
      return next();
    }
    return next(async (loop) => {
      if (!await ctx.chatluna_character.broadcast(session)) {
        return loop();
      }
    });
  });
}
__name(apply6, "apply");
var inject = {
  required: ["chatluna"],
  optional: ["chatluna_character", "vits"]
};
var inject2 = {
  chatluna: {
    required: true
  },
  chatluna_character: {
    required: false
  },
  vits: {
    required: false
  }
};
var Config = import_koishi6.Schema.intersect([
  import_koishi6.Schema.object({
    applyGroup: import_koishi6.Schema.array(import_koishi6.Schema.string()).description("应用到的群组"),
    maxMessages: import_koishi6.Schema.number().description("存储在内存里的最大消息数量").default(10).min(3).role("slider").max(100),
    disableChatLuna: import_koishi6.Schema.boolean().default(true).description("在使用此插件的群聊里，是否禁用 ChatLuna 主功能"),
    whiteListDisableChatLuna: import_koishi6.Schema.array(import_koishi6.Schema.string()).description(
      "在使用此插件时，不禁用 ChatLuna 主功能的群聊列表"
    )
  }).description("基础配置"),
  import_koishi6.Schema.object({
    model: import_koishi6.Schema.dynamic("model").default("").description("使用的模型"),
    modelOverride: import_koishi6.Schema.array(
      import_koishi6.Schema.object({
        groupId: import_koishi6.Schema.string().required().description("群组 ID"),
        model: import_koishi6.Schema.dynamic("model").default("").description("模型")
      })
    ).description("针对某个群的模型设置，会覆盖上面的配置"),
    maxTokens: import_koishi6.Schema.number().default(5e3).min(1024).max(42e3).description("聊天的最大 token 数"),
    image: import_koishi6.Schema.boolean().description(
      "是否允许输入图片（注意表情包也会输入，目前仅支持原生多模态的模型）"
    ).default(false),
    imageInputMaxCount: import_koishi6.Schema.number().default(3).min(1).max(15).description("最大的输入图片数量"),
    imageInputMaxSize: import_koishi6.Schema.number().default(3).min(1).max(20).description("最大的输入图片大小（MB）"),
    toolCalling: import_koishi6.Schema.boolean().description("是否启用工具调用功能").default(false)
  }).description("模型配置"),
  import_koishi6.Schema.object({
    isNickname: import_koishi6.Schema.boolean().description("允许 bot 配置中的昵称引发回复").default(true),
    isNickNameWithContent: import_koishi6.Schema.boolean().description(
      "是否允许在对话内容里任意匹配 bot 配置中的昵称来触发对话"
    ).default(false),
    isForceMute: import_koishi6.Schema.boolean().description(
      "是否启用强制禁言（当聊天涉及到关键词时则会禁言，关键词需要在预设文件里配置）"
    ).default(true),
    isAt: import_koishi6.Schema.boolean().description("是否允许 bot 艾特他人").default(true),
    splitVoice: import_koishi6.Schema.boolean().description("是否分段发送语音").default(false),
    splitSentence: import_koishi6.Schema.boolean().description(
      "是否启用自分割发送消息 **注意请确保你的预设和模型在使用时支持自分割消息，否则请不要关闭**"
    ).default(true),
    enableMessageId: import_koishi6.Schema.boolean().description("向模型暴露平台消息 ID，以允许发送引用消息。").default(false),
    markdownRender: import_koishi6.Schema.boolean().description(
      "是否启用 Markdown 渲染。关闭后可能会损失分割消息的精度"
    ).default(true),
    messageInterval: import_koishi6.Schema.number().default(14).min(0).role("slider").max(1e4).description("随机发送消息的最大间隔"),
    messageActivityScoreLowerLimit: import_koishi6.Schema.number().default(0.85).min(0).max(1).role("slider").step(1e-5).description(
      "消息活跃度分数的下限阈值。初始状态或长时间无人回复后，会使用此阈值判断是否响应。"
    ),
    messageActivityScoreUpperLimit: import_koishi6.Schema.number().default(0.85).min(0).max(1).role("slider").step(1e-5).description(
      "消息活跃度分数的上限阈值。每次响应后，判断阈值会向此值靠拢。若下限 < 上限（如 0.1 → 0.9），则会越聊越少；若下限 > 上限（如 0.9 → 0.2），则会越聊越多。十分钟内无人回复时，会自动回退到下限。"
    ),
    coolDownTime: import_koishi6.Schema.number().default(10).min(0).max(60 * 24).description("冷却发言时间（秒）"),
    typingTime: import_koishi6.Schema.number().default(440).min(100).role("slider").max(1500).description("模拟打字时的间隔（毫秒）"),
    largeTextSize: import_koishi6.Schema.number().default(300).min(100).max(1e3).description("大文本消息的判断阈值（字符数）"),
    largeTextTypingTime: import_koishi6.Schema.number().default(100).min(10).max(1500).description("大文本消息的固定打字间隔（毫秒）"),
    muteTime: import_koishi6.Schema.number().default(1e3 * 60).min(1e3).max(1e3 * 60 * 10 * 10).description("闭嘴时的禁言时间（毫秒）"),
    modelCompletionCount: import_koishi6.Schema.number().default(3).min(0).max(6).description("模型历史消息轮数，为 0 不发送之前的历史轮次"),
    defaultPreset: import_koishi6.Schema.dynamic("character-preset").description("使用的伪装预设").default("煕")
  }).description("对话设置"),
  import_koishi6.Schema.object({
    configs: import_koishi6.Schema.dict(
      import_koishi6.Schema.object({
        maxTokens: import_koishi6.Schema.number().default(4e3).min(1024).max(2e4).description("使用聊天的最大 token 数"),
        enableMessageId: import_koishi6.Schema.boolean().description("向模型暴露平台消息 ID，以允许发送引用消息。").default(false),
        isAt: import_koishi6.Schema.boolean().description("是否启用@").default(true),
        splitVoice: import_koishi6.Schema.boolean().description("是否分段发送语音").default(false),
        splitSentence: import_koishi6.Schema.boolean().description(
          "是否启用自分割发送消息 **注意请确保你的预设和模型在使用时支持自分割消息，否则请不要关闭**"
        ).default(true),
        markdownRender: import_koishi6.Schema.boolean().description(
          "是否启用 Markdown 渲染。关闭后可能会损失分割消息的精度"
        ).default(true),
        isNickname: import_koishi6.Schema.boolean().description("允许 bot 配置中的昵称引发回复").default(true),
        isNickNameWithContent: import_koishi6.Schema.boolean().description(
          "是否允许在对话内容里任意匹配 bot 配置中的昵称来触发对话"
        ).default(false),
        isForceMute: import_koishi6.Schema.boolean().description(
          "是否启用强制禁言（当聊天涉及到关键词时则会禁言，关键词需要在预设文件里配置）"
        ).default(true),
        messageInterval: import_koishi6.Schema.number().default(10).min(0).role("slider").max(1e4).description(
          "随机发送消息的间隔。群越活跃，这个值就会越高。"
        ),
        messageActivityScoreLowerLimit: import_koishi6.Schema.number().default(0.85).min(0).max(1).role("slider").step(1e-5).description(
          "消息活跃度分数的下限阈值。初始状态或长时间无人回复后，会使用此阈值判断是否响应。"
        ),
        messageActivityScoreUpperLimit: import_koishi6.Schema.number().default(0.85).min(0).max(1).role("slider").step(1e-5).description(
          "消息活跃度分数的上限阈值。每次响应后，判断阈值会向此值靠拢。若下限 < 上限（如 0.1 → 0.9），则会越聊越少；若下限 > 上限（如 0.9 → 0.2），则会越聊越多。十分钟内无人回复时，会自动回退到下限。"
        ),
        toolCalling: import_koishi6.Schema.boolean().description("是否启用工具调用功能").default(false),
        image: import_koishi6.Schema.boolean().description(
          "是否允许输入图片（注意表情包也会输入，目前仅支持原生多模态的模型）"
        ).default(false),
        imageInputMaxCount: import_koishi6.Schema.number().default(3).min(1).max(15).description("最大的输入图片数量"),
        imageInputMaxSize: import_koishi6.Schema.number().default(1024 * 1024 * 10).min(1024 * 1024 * 1).max(1024 * 1024 * 20).description("最大的输入图片大小（KB）"),
        coolDownTime: import_koishi6.Schema.number().default(10).min(0).max(60 * 24 * 24).description("冷却发言时间（秒）"),
        typingTime: import_koishi6.Schema.number().default(440).min(100).role("slider").max(1700).description("模拟打字时的间隔（毫秒）"),
        largeTextSize: import_koishi6.Schema.number().default(300).min(100).max(1e3).description("大文本消息的判断阈值（每段分句的字符数）"),
        largeTextTypingTime: import_koishi6.Schema.number().default(100).min(10).max(1500).description("大文本消息的模拟打字间隔（毫秒）"),
        muteTime: import_koishi6.Schema.number().default(1e3 * 60).min(1e3).max(1e3 * 60 * 10 * 10).description("闭嘴时的禁言时间（毫秒）"),
        modelCompletionCount: import_koishi6.Schema.number().default(3).min(0).max(6).description("模型历史消息轮数，为 0 不发送之前的历史轮次"),
        preset: import_koishi6.Schema.dynamic("character-preset").description("使用的伪装预设").default("煕")
      })
    ).role("table").description("分群配置，会覆盖上面的默认配置（键填写群号）")
  }).description("分群配置")
]);
var name = "chatluna-character";
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Config,
  apply,
  inject,
  inject2,
  name
});
