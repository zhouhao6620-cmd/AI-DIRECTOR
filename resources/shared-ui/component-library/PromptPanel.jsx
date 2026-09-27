// 提示词面板（05 §8.6 / §13.1）
//
// 组件库只提供入口：点「新建组件」「去 Codex 中修改」「确认入库」「丢弃」后生成一段
// 可复制的提示词。页面不调用 AI、不写文件、不自动打开窗口、不发起任何请求。
import React, {useEffect, useRef, useState} from "react";
import {Check, Copy, X} from "lucide-react";
import {PROMPT_KINDS} from "./prompts.js";

export function PromptPanel({prompt, onClose}) {
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef(null);
  const kind = PROMPT_KINDS[prompt.kind] ?? {title: "提示词", note: ""};

  useEffect(() => {
    const onKey = event => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt.text);
    } catch {
      // 无剪贴板权限时退回选中 + execCommand，仍然是「只复制」这一条动作。
      textareaRef.current?.select();
      document.execCommand?.("copy");
    }
    setCopied(true);
  };

  return <div className="library-prompt-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="library-prompt" role="dialog" aria-modal="true" aria-label={kind.title} data-library-prompt={prompt.kind}>
      <header>
        <div>
          <h2>{kind.title}</h2>
          <p>{kind.note}</p>
        </div>
        <button className="library-prompt-close" type="button" aria-label="关闭提示词" onClick={onClose}><X size={15} /></button>
      </header>
      <pre className="library-prompt-text" data-library-prompt-text>{prompt.text}</pre>
      <textarea className="visually-hidden" ref={textareaRef} readOnly value={prompt.text} aria-hidden="true" tabIndex={-1} />
      <footer>
        <span>{prompt.target ? `目标：${prompt.target}` : "页面只复制提示词，不写入任何文件。"}</span>
        <button className="button primary" type="button" data-library-copy onClick={copy}>
          {copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "已复制" : "复制提示词"}
        </button>
      </footer>
    </section>
  </div>;
}
