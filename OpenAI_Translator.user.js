// ==UserScript==
// @name         Ai划词翻译
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  选中文字后弹出翻译图标，支持划词翻译。无悬浮球，UI 全面现代化升级 (毛玻璃/柔和阴影/极简风)。
// @author       Free White Dove
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // --- 接口预设配置 ---
    const PRESETS = {
        "openai_compat": {
            name: "OpenAI API 兼容",
            url: "",
            model: "gpt-3.5-turbo"
        },
        "claude_compat": {
            name: "Claude API 兼容",
            url: "",
            model: "claude-3-5-sonnet-20240620"
        },
        "gemini_compat": {
            name: "Gemini API 兼容",
            url: "",
            model: "gemini-1.5-pro"
        },
        "siliconflow": {
            name: "硅基流动 (官方)",
            url: "https://api.siliconflow.cn/v1/chat/completions",
            model: "deepseek-ai/DeepSeek-V2.5"
        }
    };

    // --- 默认配置 ---
    const DEFAULT_SYSTEM_PROMPT = "You are a professional translation engine. Translate the user input into {targetLang}. Rules: 1. Only output the result. 2. No explanations. 3. Keep original formatting. 4. Do not answer questions.";

    // --- 全新升级的 UI 样式 (Modern Clean) ---
    const STYLES = `
        :root {
            --ai-primary: #2563eb;
            --ai-primary-hover: #1d4ed8;
            --ai-bg: rgba(255, 255, 255, 0.85);
            --ai-border: rgba(255, 255, 255, 0.6);
            --ai-shadow: 0 10px 40px -10px rgba(0,0,0,0.15), 0 0 2px rgba(0,0,0,0.1);
            --ai-text: #1f2937;
            --ai-text-sub: #6b7280;
            --ai-radius: 12px;
            --ai-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }

        /* 划词图标 - 更灵动 */
        .ai-trans-icon {
            position: absolute; width: 32px; height: 32px;
            background: #fff; border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.12);
            cursor: pointer; z-index: 999999;
            display: flex; align-items: center; justify-content: center;
            transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
            border: 1px solid rgba(0,0,0,0.05);
        }
        .ai-trans-icon:hover { transform: scale(1.1) translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.15); }
        .ai-trans-icon svg { width: 18px; height: 18px; fill: var(--ai-primary); }

        /* 翻译面板 - 毛玻璃风格 */
        .ai-trans-panel {
            position: absolute; width: 360px; max-width: 90vw;
            background: var(--ai-bg);
            backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255,255,255,0.5);
            border-radius: var(--ai-radius);
            box-shadow: var(--ai-shadow);
            z-index: 999999;
            font-family: var(--ai-font);
            font-size: 14px; line-height: 1.6; color: var(--ai-text);
            display: flex; flex-direction: column;
            animation: ai-fade-in 0.2s ease-out;
        }

        @keyframes ai-fade-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

        /* 头部 */
        .ai-trans-header {
            padding: 12px 16px;
            border-bottom: 1px solid rgba(0,0,0,0.05);
            display: flex; justify-content: space-between; align-items: center;
            cursor: move; user-select: none;
        }
        .ai-header-title { font-weight: 600; font-size: 13px; color: var(--ai-text); display: flex; align-items: center; gap: 6px; }
        .ai-header-title::before { content: ''; width: 6px; height: 6px; background: var(--ai-primary); border-radius: 50%; }

        .ai-trans-controls { display: flex; align-items: center; gap: 8px; }
        .ai-icon-btn {
            cursor: pointer; color: var(--ai-text-sub); padding: 4px; border-radius: 4px;
            font-size: 14px; transition: all 0.2s; display: flex; align-items: center; justify-content: center;
        }
        .ai-icon-btn:hover { background: rgba(0,0,0,0.05); color: var(--ai-text); }

        /* 内容区域 */
        .ai-trans-content {
            padding: 16px; max-height: 400px; overflow-y: auto;
            white-space: pre-wrap; word-break: break-word;
        }

        /* 自定义滚动条 */
        .ai-trans-content::-webkit-scrollbar { width: 6px; }
        .ai-trans-content::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 3px; }
        .ai-trans-content::-webkit-scrollbar-track { background: transparent; }

        /* 设置遮罩 */
        .ai-setting-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.3); backdrop-filter: blur(2px);
            z-index: 1000000;
            display: flex; justify-content: center; align-items: center;
            animation: ai-fade-in 0.2s;
        }

        /* 设置盒子 */
        .ai-setting-box {
            background: #fff; padding: 24px; border-radius: 16px; width: 420px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.2);
            display: flex; flex-direction: column; gap: 16px;
            font-family: var(--ai-font);
        }
        .ai-setting-header {
            font-size: 18px; font-weight: 700; color: #111;
            border-bottom: 1px solid #f3f4f6; padding-bottom: 12px; margin-bottom: 4px;
        }

        /* 表单元素优化 */
        .ai-setting-row label {
            display: block; margin-bottom: 6px; font-weight: 500; font-size: 13px; color: #4b5563;
        }
        .ai-setting-row input, .ai-setting-row select {
            width: 100%; padding: 10px 12px;
            border: 1px solid transparent;
            background: #f3f4f6; /* 浅灰背景 */
            border-radius: 8px;
            font-size: 14px; color: #333;
            transition: all 0.2s; box-sizing: border-box;
        }
        .ai-setting-row input:focus, .ai-setting-row select:focus {
            background: #fff;
            border-color: var(--ai-primary);
            box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
            outline: none;
        }

        /* 底部按钮组 */
        .ai-setting-footer { margin-top: 8px; display: flex; flex-direction: column; gap: 12px; }
        .ai-btn-group-func { display: flex; gap: 10px; }
        .ai-btn-group-action { display: flex; justify-content: flex-end; gap: 10px; padding-top: 12px; border-top: 1px solid #f3f4f6; }

        .ai-btn {
            padding: 9px 16px; border: none; border-radius: 8px;
            cursor: pointer; font-weight: 500; font-size: 13px;
            transition: all 0.2s; position: relative; overflow: hidden;
        }
        .ai-btn:active { transform: scale(0.98); }

        .ai-btn-primary { background: var(--ai-primary); color: white; box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3); }
        .ai-btn-primary:hover { background: var(--ai-primary-hover); }

        .ai-btn-secondary { background: #fff; border: 1px solid #e5e7eb; color: #374151; }
        .ai-btn-secondary:hover { background: #f9fafb; border-color: #d1d5da; }

        .ai-btn-fetch { background: #8b5cf6; color: white; flex: 1; }
        .ai-btn-fetch:hover { background: #7c3aed; }

        .ai-btn-test-chat { background: #10b981; color: white; flex: 1; }
        .ai-btn-test-chat:hover { background: #059669; }

        .ai-hint { font-size: 12px; color: #6b7280; min-height: 20px; line-height: 1.4; }

        /* 正在翻译的高亮 */
        .ai-translating-text { background: rgba(37, 99, 235, 0.1); border-bottom: 2px solid var(--ai-primary); }
    `;

    GM_addStyle(STYLES);

    // --- 状态管理 ---
    let iconEl = null;
    let panelEl = null;
    let selectedText = "";

    // --- 初始化 ---
    GM_registerMenuCommand("⚙️ 配置后台", showSettings);

    // --- 1. 划词逻辑 ---
    document.addEventListener('mouseup', (e) => {
        if (e.target.closest('.ai-trans-panel') || e.target.closest('.ai-trans-icon') ||
            e.target.closest('.ai-setting-overlay')) return;

        setTimeout(() => {
            const selection = window.getSelection();
            const text = selection.toString().trim();
            if (text.length > 0) {
                selectedText = text;
                showIcon(e.pageX, e.pageY);
            } else {
                hideIcon();
            }
        }, 10);
    });

    document.addEventListener('mousedown', (e) => {
        if (!e.target.closest('.ai-trans-panel') && !e.target.closest('.ai-trans-icon') &&
            !e.target.closest('.ai-setting-overlay')) {
            hideIcon();
            if (panelEl) {
                // 增加一个淡出动画
                panelEl.style.opacity = '0';
                panelEl.style.transform = 'translateY(5px)';
                setTimeout(() => { if(panelEl) panelEl.remove(); panelEl = null; }, 200);
            }
        }
    });

    // v1.1 alt+鼠标中键 使用沉浸翻译
    document.addEventListener('mousedown', function (event) {
        if (event.button === 1 && event.altKey) {
            const clickedElement = event.target;
            event.preventDefault();
            if (!clickedElement.hasAttribute('translated') && clickedElement.innerHTML.length < 6000) {
                const config = getConfig();
                if (!config.apiKey) {
                    showPanel(event.pageX, event.pageY, `⚠️ 请先在油猴菜单中配置 API Key`);
                    return;
                }
                clickedElement.toggleAttribute("translated", true);
                clickedElement.toggleAttribute("translating", true);
                callAI(clickedElement.innerHTML, config, null, (innerHTML) => {
                    const el = Object.assign(document.createElement(clickedElement.tagName), { innerHTML });
                    el.toggleAttribute("translated", true);
                    clickedElement.appendChild(el);
                    clickedElement.toggleAttribute("translating", false);
                }, (err) => {
                    if(panelEl) panelEl.querySelector('.ai-trans-content').innerHTML = `<span style="color:#ef4444">${err}</span>`;
                });
            }
        }
    }, true);
    // --- 2. 核心配置存取 ---
    function getSafeConfigs() {
        let savedConfigs = GM_getValue('provider_configs', {});
        const legacyApiKey = GM_getValue('apiKey', '');
        if (Object.keys(savedConfigs).length === 0 && legacyApiKey) {
            const legacyProvider = GM_getValue('provider', 'siliconflow');
            savedConfigs[legacyProvider] = {
                apiUrl: GM_getValue('apiUrl', PRESETS[legacyProvider].url),
                apiKey: legacyApiKey,
                model: GM_getValue('model', PRESETS[legacyProvider].model)
            };
        }
        for (const key in PRESETS) {
            if (!savedConfigs[key]) {
                savedConfigs[key] = {
                    apiUrl: PRESETS[key].url,
                    apiKey: "",
                    model: PRESETS[key].model
                };
            }
        }
        return savedConfigs;
    }

    function getConfig() {
        const provider = GM_getValue('provider', 'siliconflow');
        const allConfigs = getSafeConfigs();
        const activeConfig = allConfigs[provider];
        return {
            provider: provider,
            apiUrl: activeConfig.apiUrl || PRESETS[provider].url,
            apiKey: activeConfig.apiKey || "",
            model: activeConfig.model || PRESETS[provider].model,
            targetLang: GM_getValue('targetLang', 'Simplified Chinese')
        };
    }

    // --- 3. UI 组件：划词图标 ---
    function showIcon(x, y) {
        hideIcon();
        iconEl = document.createElement('div');
        iconEl.className = 'ai-trans-icon';
        // 使用更现代的图标 (Feather Icons style)
        iconEl.innerHTML = `<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8l6 6"/><path d="M4 14h6"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/></svg>`;
        iconEl.style.left = `${x + 10}px`;
        iconEl.style.top = `${y + 10}px`;
        iconEl.addEventListener('click', (e) => {
            e.stopPropagation();
            doSelectionTranslate(x, y);
            hideIcon();
        });
        document.body.appendChild(iconEl);
    }

    function hideIcon() {
        if (iconEl) { iconEl.remove(); iconEl = null; }
    }

    // --- 4. UI 组件：翻译面板 ---
    function showPanel(x, y, content) {
        if (panelEl) panelEl.remove();

        panelEl = document.createElement('div');
        panelEl.className = 'ai-trans-panel';
        panelEl.style.left = `${x}px`;
        panelEl.style.top = `${y + 20}px`;

        panelEl.innerHTML = `
            <div class="ai-trans-header">
                <div class="ai-header-title">AI Translate</div>
                <div class="ai-trans-controls">
                    <div class="ai-icon-btn ai-trans-copy" title="复制">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    </div>
                    <div class="ai-icon-btn ai-setting-trigger" title="设置">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    </div>
                    <div class="ai-icon-btn ai-trans-close" title="关闭">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </div>
                </div>
            </div>
            <div class="ai-trans-content">${content}</div>
        `;

        panelEl.querySelector('.ai-trans-close').addEventListener('click', () => {
            panelEl.remove(); panelEl = null;
        });

        panelEl.querySelector('.ai-setting-trigger').addEventListener('click', showSettings);

        const copyBtn = panelEl.querySelector('.ai-trans-copy');
        copyBtn.addEventListener('click', () => {
            const text = panelEl.querySelector('.ai-trans-content').innerText;
            GM_setClipboard(text);
            copyBtn.style.color = '#10b981';
            setTimeout(() => copyBtn.style.color = '', 1500);
        });

        const header = panelEl.querySelector('.ai-trans-header');
        let isDragging = false, startX, startY, initialLeft, initialTop;

        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.ai-icon-btn')) return;
            isDragging = true;
            startX = e.clientX; startY = e.clientY;
            initialLeft = panelEl.offsetLeft; initialTop = panelEl.offsetTop;
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            panelEl.style.left = `${initialLeft + (e.clientX - startX)}px`;
            panelEl.style.top = `${initialTop + (e.clientY - startY)}px`;
        });
        document.addEventListener('mouseup', () => isDragging = false);

        document.body.appendChild(panelEl);
        return panelEl;
    }

    // --- 5. 核心逻辑：API 请求 ---
    function callAI(text, config, onChunk, onDone, onError) {
        const sysPrompt = DEFAULT_SYSTEM_PROMPT.replace('{targetLang}', config.targetLang);
        const userContent = `Translate the following content into ${config.targetLang} strictly. content:\n\n${text}`;

        const payload = {
            model: config.model,
            messages: [
                { role: "system", content: sysPrompt },
                { role: "user", content: userContent }
            ],
            stream: false
        };

        const headers = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${config.apiKey}`
        };

        GM_xmlhttpRequest({
            method: "POST",
            url: config.apiUrl,
            headers: headers,
            data: JSON.stringify(payload),
            anonymous: true,
            onload: function(response) {
                if (response.status !== 200) {
                    try {
                        const errData = JSON.parse(response.responseText);
                        if (errData.error?.type === 'usage_limit_reached' || errData.error?.code === 'insufficient_quota') {
                            onError(`⚠️ 额度已用尽 (Usage Limit Reached)。`);
                            return;
                        }
                        onError(`HTTP ${response.status}: ${errData.error?.message || response.statusText}`);
                    } catch (e) {
                        onError(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    return;
                }

                try {
                    const resJson = JSON.parse(response.responseText);
                    if (resJson.error) {
                        onError(resJson.error.message);
                    } else if (resJson.choices && resJson.choices.length > 0) {
                        onDone(resJson.choices[0].message.content);
                    } else {
                        onError("响应异常 (无内容)");
                    }
                } catch (e) {
                     onError(`解析错误: ${e.message}`);
                }
            },
            onerror: function(err) { onError("网络连接失败"); }
        });
    }

    // --- 6. 划词翻译 ---
    function doSelectionTranslate(x, y) {
        const config = getConfig();
        if (!config.apiKey) {
            showPanel(x, y, `⚠️ 请先在油猴菜单中配置 API Key`);
            return;
        }
        showPanel(x, y, `<div style="color:#999; font-style:italic;">Thinking...</div>`);
        callAI(selectedText, config, null, (text) => {
            if(panelEl) panelEl.querySelector('.ai-trans-content').innerText = text;
        }, (err) => {
            if(panelEl) panelEl.querySelector('.ai-trans-content').innerHTML = `<span style="color:#ef4444">${err}</span>`;
        });
    }

    // --- 7. 设置后台 ---
    function showSettings() {
        const existing = document.querySelector('.ai-setting-overlay');
        if (existing) existing.remove();

        let allConfigs = getSafeConfigs();
        let currentProvider = GM_getValue('provider', 'siliconflow');
        let currentTargetLang = GM_getValue('targetLang', 'Simplified Chinese');

        const overlay = document.createElement('div');
        overlay.className = 'ai-setting-overlay';

        let providerOptions = "";
        for (let key in PRESETS) {
            providerOptions += `<option value="${key}" ${currentProvider === key ? 'selected' : ''}>${PRESETS[key].name}</option>`;
        }

        overlay.innerHTML = `
            <div class="ai-setting-box">
                <div class="ai-setting-header">翻译设置</div>

                <div class="ai-setting-row">
                    <label>供应商 (Provider)</label>
                    <select id="ai-cfg-provider">${providerOptions}</select>
                </div>

                <div class="ai-setting-row">
                    <label>接口地址 (API URL)</label>
                    <input type="text" id="ai-cfg-url" placeholder="https://api.openai.com/v1/chat/completions">
                </div>

                <div class="ai-setting-row">
                    <label>密钥 (API Key)</label>
                    <input type="password" id="ai-cfg-key" placeholder="sk-...">
                </div>

                <div class="ai-setting-row">
                    <label>模型 (Model)</label>
                    <input type="text" id="ai-cfg-model" placeholder="gpt-3.5-turbo" list="ai-model-datalist">
                    <datalist id="ai-model-datalist"></datalist>
                </div>

                <div class="ai-setting-row">
                    <label>目标语言 (Target)</label>
                    <input type="text" id="ai-cfg-lang" value="${currentTargetLang}" placeholder="Simplified Chinese" list="ai-lang-list">
                    <datalist id="ai-lang-list">
                        <option value="Simplified Chinese">简体中文</option>
                        <option value="English">英语</option>
                        <option value="Japanese">日语</option>
                        <option value="Russian">俄语</option>
                        <option value="German">德语</option>
                        <option value="French">法语</option>
                    </datalist>
                </div>

                <div class="ai-hint" id="ai-test-result"></div>

                <div class="ai-setting-footer">
                    <div class="ai-btn-group-func">
                        <button class="ai-btn ai-btn-fetch" id="ai-cfg-fetch-models">📡 拉取模型</button>
                        <button class="ai-btn ai-btn-test-chat" id="ai-cfg-test-chat">⚡ 测试对话</button>
                    </div>
                    <div class="ai-btn-group-action">
                        <button class="ai-btn ai-btn-secondary" id="ai-cfg-cancel">取消</button>
                        <button class="ai-btn ai-btn-primary" id="ai-cfg-save">保存配置</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const providerSelect = document.getElementById('ai-cfg-provider');
        const urlInput = document.getElementById('ai-cfg-url');
        const keyInput = document.getElementById('ai-cfg-key');
        const modelInput = document.getElementById('ai-cfg-model');
        const langInput = document.getElementById('ai-cfg-lang');
        const resultDiv = document.getElementById('ai-test-result');

        function fillForm(provider) {
            const conf = allConfigs[provider] || PRESETS[provider];
            urlInput.value = conf.apiUrl || "";
            keyInput.value = conf.apiKey || "";
            modelInput.value = conf.model || "";
        }

        function saveFormToMemory(provider) {
            allConfigs[provider] = {
                apiUrl: urlInput.value.trim(),
                apiKey: keyInput.value.trim(),
                model: modelInput.value.trim()
            };
        }

        fillForm(currentProvider);

        providerSelect.addEventListener('change', () => {
            const newProvider = providerSelect.value;
            saveFormToMemory(currentProvider);
            currentProvider = newProvider;
            fillForm(currentProvider);
            resultDiv.innerHTML = ``;
        });

        function checkAndFixUrl() {
            let apiUrl = urlInput.value.trim();
            if (!apiUrl) return null;
            if (!apiUrl.includes('/chat/completions')) {
                const cleanUrl = apiUrl.replace(/\/+$/, '');
                const newUrl = cleanUrl + '/v1/chat/completions';
                if(confirm(`检测到您的接口地址可能不完整：\n\n当前：${apiUrl}\n建议：${newUrl}\n\n是否自动修正？`)) {
                    apiUrl = newUrl;
                    urlInput.value = apiUrl;
                }
            }
            return apiUrl;
        }

        document.getElementById('ai-cfg-fetch-models').addEventListener('click', () => {
            const apiUrl = checkAndFixUrl();
            const apiKey = keyInput.value.trim();
            if (!apiUrl || !apiKey) {
                resultDiv.innerHTML = `<span style="color:#ef4444">请先填写接口地址和 API Key</span>`;
                return;
            }
            resultDiv.innerHTML = `<span style="color:#2563eb">正在获取模型列表...</span>`;
            let modelsUrl = apiUrl.replace(/\/chat\/completions\/?$/, "/models");
            if (modelsUrl === apiUrl) modelsUrl = apiUrl.replace(/\/$/, '') + '/models';

            GM_xmlhttpRequest({
                method: "GET", url: modelsUrl, headers: { "Authorization": `Bearer ${apiKey}` }, anonymous: true,
                onload: function(response) {
                    try {
                        const res = JSON.parse(response.responseText);
                        if (res.data && Array.isArray(res.data)) {
                            const dataList = document.getElementById('ai-model-datalist');
                            dataList.innerHTML = '';
                            res.data.forEach(m => {
                                const opt = document.createElement('option');
                                opt.value = m.id;
                                dataList.appendChild(opt);
                            });
                            resultDiv.innerHTML = `<span style="color:#10b981">✅ 已拉取 ${res.data.length} 个模型</span>`;
                            modelInput.style.borderColor = '#10b981';
                            setTimeout(() => modelInput.style.borderColor = '', 1000);
                        } else { resultDiv.innerHTML = `<span style="color:#f59e0b">⚠️ 接口正常但无列表数据</span>`; }
                    } catch(e) { resultDiv.innerHTML = `<span style="color:#ef4444">❌ 解析失败</span>`; }
                },
                onerror: function() { resultDiv.innerHTML = `<span style="color:#ef4444">❌ 网络错误</span>`; }
            });
        });

        document.getElementById('ai-cfg-test-chat').addEventListener('click', () => {
            const apiUrl = checkAndFixUrl();
            const apiKey = keyInput.value.trim();
            const currentModel = modelInput.value.trim();
            if (!apiUrl || !apiKey) {
                resultDiv.innerHTML = `<span style="color:#ef4444">请先填写接口地址和 API Key</span>`;
                return;
            }
            resultDiv.innerHTML = `<span style="color:#2563eb">正在测试对话 (Hello)...</span>`;

            const tempConfig = { apiUrl, apiKey, model: currentModel || "gpt-3.5-turbo", targetLang: "English" };

            callAI("Hello", tempConfig, null, (res) => {
                resultDiv.innerHTML = `<span style="color:#10b981">✅ 测试通过: ${res.substring(0, 10)}...</span>`;
            }, (err) => {
                resultDiv.innerHTML = `<span style="color:#ef4444">❌ 失败: ${err}</span>`;
            });
        });

        document.getElementById('ai-cfg-save').addEventListener('click', () => {
            saveFormToMemory(currentProvider);
            GM_setValue('provider_configs', allConfigs);
            GM_setValue('provider', currentProvider);
            GM_setValue('targetLang', langInput.value.trim());

            const saveBtn = document.getElementById('ai-cfg-save');
            const originalText = saveBtn.innerText;
            saveBtn.innerText = "已保存";
            saveBtn.style.background = "#10b981";
            setTimeout(() => {
                saveBtn.innerText = originalText;
                saveBtn.style.background = "";
                overlay.remove();
            }, 600);
        });

        document.getElementById('ai-cfg-cancel').addEventListener('click', () => overlay.remove());
    }

})();
