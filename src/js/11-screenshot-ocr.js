(function() {
    // ══ 阿里云百炼 API 配置 ══
    const KEY_STORAGE = 'bailian_api_key';
    const MODEL_STORAGE = 'bailian_model';

    // 初始化时加载配置到输入框
    window.addEventListener('DOMContentLoaded', () => {
        const keyInput = document.getElementById('bailian-api-key');
        const modelSelect = document.getElementById('bailian-model');
        if (keyInput) keyInput.value = localStorage.getItem(KEY_STORAGE) || '';
        if (modelSelect) modelSelect.value = localStorage.getItem(MODEL_STORAGE) || 'qwen-vl-plus';
    });

    // 保存配置
    window.saveBailianConfig = function() {
        const keyVal = document.getElementById('bailian-api-key').value.trim();
        const modelVal = document.getElementById('bailian-model').value;
        localStorage.setItem(KEY_STORAGE, keyVal);
        localStorage.setItem(MODEL_STORAGE, modelVal);
        showToast('API 设置已保存 ✓');
    };

    // 触发隐藏的图片上传文件域
    window.triggerScreenshotUpload = function(e) {
        if (e) e.preventDefault();
        const api = localStorage.getItem(KEY_STORAGE);
        if (!api) {
            showToast('⚠️ 请先在页面底部【备份与设置】中配置百炼 API Key');
            // 滚动到备份与设置板块
            const backupEl = document.getElementById('stats-backup');
            if (backupEl) {
                switchPage('stats');
                backupEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }
        document.getElementById('screenshot-upload').click();
    };

    // 文件上传处理入口
    window.handleScreenshotUpload = function(input) {
        if (input.files && input.files[0]) {
            processScreenshotFile(input.files[0]);
            input.value = ''; // 清空选择，允许重复上传同一张图
        }
    };

    // 监听粘贴事件（方便电脑端快捷键截图粘贴）
    window.addEventListener('paste', (e) => {
        const items = (e.clipboardData || window.clipboardData).items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                const api = localStorage.getItem(KEY_STORAGE);
                if (!api) {
                    showToast('⚠️ 监听到粘贴图片，但尚未配置百炼 API Key，无法识别');
                    return;
                }
                processScreenshotFile(file);
                break;
            }
        }
    });

    // 处理图片并调用 API
    async function processScreenshotFile(file) {
        const loadingMask = document.getElementById('ocr-loading-mask');
        if (loadingMask) loadingMask.style.display = 'flex';

        try {
            const base64 = await fileToBase64(file);
            const data = await callBailianVisionAPI(base64);
            
            if (loadingMask) loadingMask.style.display = 'none';
            
            if (data) {
                const status = fillDataToForm(data);
                if (status && status.descMissing) {
                    showToast('💡 金额和店家已回填～ 但这张截图只有付款信息，没有“买了什么”，AI 认不出来，请在「花了什么」里补一句再保存', 5000);
                } else {
                    showToast('✓ 截图解析成功，数据已自动回填');
                }
            } else {
                showToast('❌ 未能解析出有效账单数据，请重试');
            }
        } catch (error) {
            if (loadingMask) loadingMask.style.display = 'none';
            console.error('OCR Error:', error);
            showToast('❌ 识别失败: ' + (error.message || '网络或API配置错误'));
        }
    }

    // 文件转 Base64 辅助函数
    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    // 调用阿里云百炼多模态接口
    async function callBailianVisionAPI(base64Image) {
        const apiKey = localStorage.getItem(KEY_STORAGE);
        const model = localStorage.getItem(MODEL_STORAGE) || 'qwen-vl-plus';
        
        if (!apiKey) {
            throw new Error('未配置 API Key');
        }

        const prompt = `请作为精准的记账助手分析这张账单/订单截图，提取关键的消费信息。
请输出以下 JSON 格式的文本，不要包含 Markdown 格式标记（如 \`\`\`json\`\`\`），也不要有任何多余的解释。

{
  "amount": 0.00, // 必填，实付款金额（必须是数字，需要扣除各种优惠和红包后的最终实付款）
  "desc": "商品名称及规格", // 必填。商品名称且【必须保留规格、重量、数量、卷数等细节】，例如“维达纸巾 4斤18卷”或“纯牛奶 250ml*24盒”，绝对不能擅自简化或忽略这些数量/重量规格信息！
  "place": "渠道平台", // 必填，电商或渠道名，必须是以下之一: 淘宝, 京东, 拼多多, 1688, 美团, 饿了么, 微信, 其他网购, 或者是线下实体店名
  "shopName": "店铺名称", // 选填，具体网购店铺名称或实体商家店名（如无则留空 ""）
  "spendKey": "分类键名", // 必填，根据商品类型匹配并挑选以下最合适的一个英文分类键名:
      // breakfast(早饭), lunch(午饭), dinner(晚饭), snack(零食/饮品), grocery(买菜), transport(交通出行),
      // household(日用品), medical(健康/医疗), education(学习/订阅), entertainment(娱乐休闲), beauty(个人护理),
      // gift(礼物/人情), clothes(衣物鞋包), pet(宠物), repair(维修/服务), travel(出行旅游), other(其他)
  "date": "YYYY-MM-DD" // 选填，账单对应的实际交易日期。如果截图上能清晰看到日期（如“2026-07-03”或“今天”等折算后的日期）则填入，如果无法确定则留空 ""
}

识别与平台判断指南：
- 拼多多识别线索：若界面出现“拼单”、“免拼”、“待拼单”、“拼图”或标志性的拼多多红白色调，应判定 place 为“拼多多”。
- 1688 识别线索：若出现“1688”、“批发”、“阿里巴巴”等字样或其橙色标志，应判定 place 为“1688”。
- 淘宝/天猫识别线索：出现“天猫”、“淘宝”、“宝贝”、“购物车”或橙色调。
- 京东识别线索：出现“京东”、“京喜”或红狗Logo。
- 实付款判定：必须优先寻找“实付款”、“合计”、“支付金额”、“实付”右侧的数字，避开原价、省下、优惠等干扰数字。若金额前带负号（如“-7.00”），取其绝对值。
- 【重要】desc 只能写你真正能判断出的“商品/消费内容”。如果截图里根本没有商品名（例如微信/支付宝的“扫二维码付款”“转账”详情页，只有金额和商户名），desc 就填商户名或直接留空 ""，绝对不要把“交易单号/商户单号/订单号”这类纯数字串填进 desc。
- 微信/支付宝的“扫二维码付款”“转账”详情页通常是线下消费：place 填商户名（线下实体店），并把商户名同时写进 shopName；date 用页面上的“转账时间/支付时间”折算成 YYYY-MM-DD。
- 确保输出的 JSON 格式正确，属性名必须使用双引号。`;

        const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'image_url',
                                image_url: {
                                    url: base64Image
                                }
                            },
                            {
                                type: 'text',
                                text: prompt
                            }
                        ]
                    }
                ]
            })
        });

        if (!response.ok) {
            const errInfo = await response.json().catch(() => ({}));
            throw new Error(errInfo.error?.message || `HTTP 错误码: ${response.status}`);
        }

        const resData = await response.json();
        let content = resData.choices?.[0]?.message?.content;
        if (!content) {
            throw new Error('API 未返回有效内容');
        }

        // 清理可能带有的 Markdown 包装
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();

        try {
            return JSON.parse(content);
        } catch (e) {
            console.error('JSON Parse failed on content:', content);
            throw new Error('接口返回格式无法解析为JSON');
        }
    }

    // 将解析出的数据回填至前端表单
    function fillDataToForm(data) {
        // 1. 切换回记账页（防止在统计页操作时视图未刷新）
        switchPage('record');

        // 2. 填写金额
        if (data.amount && parseFloat(data.amount) > 0) {
            document.getElementById('amount-input').value = parseFloat(data.amount);
        }

        // 3. 填写描述（包含完整的规格）
        //    兜底：模型有时会把“交易单号/商户单号”这类纯数字串误当成商品名，这里挡掉
        let descFilled = false;
        if (data.desc) {
            const d = String(data.desc).trim();
            const isPureNumber = /^\d{6,}$/.test(d.replace(/[\s-]/g, ''));
            if (d && !isPureNumber) {
                document.getElementById('desc-input').value = d;
                descFilled = true;
            }
        }
        //    描述没识别出来时，退回用店名占位，方便用户在原地补写
        if (!descFilled && data.shopName) {
            document.getElementById('desc-input').value = String(data.shopName).trim();
        }

        // 4. 选中消费分类 Chip
        if (data.spendKey) {
            document.querySelectorAll('.chip[data-group="spend"]').forEach(chip => {
                const match = chip.dataset.key === data.spendKey;
                chip.classList.toggle('sel', match);
            });
            // 触发分类联动的智能推荐面板更新
            if (typeof buildCatHistory === 'function') buildCatHistory(data.spendKey);
            if (typeof buildSmartAmt === 'function') buildSmartAmt(data.spendKey);
            if (typeof buildSmartPlace === 'function') buildSmartPlace(data.spendKey);
        }

        // 5. 选中平台及具体店铺 (使用模糊匹配)
        let matchedPlaceKey = '';
        if (data.place) {
            const rawPlace = data.place.trim();
            document.getElementById('place-input').value = rawPlace;
            
            // 模糊匹配常见平台
            let mappedKey = '';
            if (/淘宝|天猫|taobao/i.test(rawPlace)) {
                mappedKey = 'taobao';
            } else if (/京东|jd/i.test(rawPlace)) {
                mappedKey = 'jd';
            } else if (/拼多多|pdd/i.test(rawPlace)) {
                mappedKey = 'pdd';
            } else if (/美团/i.test(rawPlace)) {
                mappedKey = 'meituan';
            } else if (/饿了么/i.test(rawPlace)) {
                mappedKey = 'eleme';
            } else if (/1688|阿里巴巴|alibaba/i.test(rawPlace)) {
                // 1688 归为其他网购，并在具体店名里前缀标明
                mappedKey = 'online_other';
                document.getElementById('place-input').value = '1688';
            } else if (/网购|线上/i.test(rawPlace)) {
                mappedKey = 'online_other';
            }

            if (mappedKey) {
                matchedPlaceKey = mappedKey;
                document.querySelectorAll('.chip[data-group="place"]').forEach(chip => {
                    chip.classList.toggle('sel', chip.dataset.key === mappedKey);
                });
            } else {
                document.querySelectorAll('.chip[data-group="place"]').forEach(chip => chip.classList.remove('sel'));
            }
        }

        // 6. 店铺具体名称
        const shopBox = document.getElementById('shop-box');
        const shopInput = document.getElementById('shop-input');
        const onlineKeys = ['taobao', 'jd', 'pdd', 'meituan', 'eleme', 'online_other'];
        
        let finalShopName = data.shopName || '';
        // 如果是 1688 且返回的 shopName 里面没有写 1688，前缀加上以便辨识
        if (/1688/i.test(data.place) && finalShopName && !/1688/.test(finalShopName)) {
            finalShopName = '1688 - ' + finalShopName;
        } else if (/1688/i.test(data.place) && !finalShopName) {
            finalShopName = '1688 批发商';
        }

        if (finalShopName && shopInput) {
            shopInput.value = finalShopName;
            if (shopBox) shopBox.classList.add('show');
        } else if (onlineKeys.includes(matchedPlaceKey)) {
            if (shopBox) shopBox.classList.add('show');
        } else {
            if (shopBox) shopBox.classList.remove('show');
        }

        // 7. 处理日期（如有明晰日期，且格式符合）
        if (data.date && /^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
            const dateInput = document.getElementById('record-date');
            if (dateInput) {
                dateInput.value = data.date;
                if (typeof loadDateEntries === 'function') loadDateEntries();
            }
        }

        // 8. 默认展开地点/原因，方便用户审查和补填具体原因
        if (typeof toggleExtra === 'function') {
            toggleExtra(true);
        }

        // 滚动到最顶部（让用户能够清楚检查回填的金额和描述）
        document.getElementById('amount-input').scrollIntoView({ behavior: 'smooth', block: 'center' });

        // 返回状态：让上层根据“描述有没有识别出来”给出温和提示
        return { descMissing: !descFilled };
    }
})();
