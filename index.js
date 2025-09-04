console.log('🔌 分层人物世界书系统插件文件已加载');
// 世界书管理器
class WorldBookManager {
    constructor(plugin) {
        this.plugin = plugin;
        this.indexEntryId = 'CHARACTER_INDEX';
    }

    async getCurrentWorldBook() {
        // 模拟获取当前世界书
        return {
            entries: []
        };
    }

    async createIndexEntry() {
        console.log('创建人物索引条目');
        // 实际实现中会调用SillyTavern的API创建世界书条目
    }

    async updateIndexEntry(content) {
        console.log('更新人物索引条目');
        // 实际实现中会调用SillyTavern的API更新世界书条目
    }

    async createCharacterEntry(character) {
        console.log(`创建人物条目: ${character.name}`);
        // 实际实现中会调用SillyTavern的API创建世界书条目
    }
}

// 智能触发系统
class SmartTriggerSystem {
    constructor(plugin) {
        this.plugin = plugin;
        this.lastTriggerTime = 0;
    }

    checkTrigger(message) {
        const now = Date.now();
        if (now - this.lastTriggerTime < this.plugin.settings.triggerCooldown) {
            return false;
        }

        const shouldTrigger = this.plugin.shouldGenerateCharacter(message);
        if (shouldTrigger) {
            this.lastTriggerTime = now;
            return true;
        }

        return false;
    }
}

// 人物重要性管理器
class CharacterImportanceManager {
    constructor(plugin) {
        this.plugin = plugin;
    }

    checkImportanceUpgrade(characterId) {
        const character = this.plugin.characters.get(characterId);
        if (!character) return;

        const thresholds = this.plugin.importanceLevels;
        const currentLevel = character.importance;
        const interactionCount = character.interactionCount;

        let shouldUpgrade = false;
        let newLevel = currentLevel;

        if (currentLevel === 'background' && interactionCount >= thresholds.secondary.upgradeThreshold) {
            newLevel = 'secondary';
            shouldUpgrade = true;
        } else if (currentLevel === 'secondary' && interactionCount >= thresholds.main.upgradeThreshold) {
            newLevel = 'main';
            shouldUpgrade = true;
        }

        if (shouldUpgrade) {
            this.upgradeCharacterImportance(characterId, newLevel);
        }
    }

    upgradeCharacterImportance(characterId, newLevel) {
        const character = this.plugin.characters.get(characterId);
        if (!character) return;

        console.log(`升级人物重要性: ${character.name} 从 ${character.importance} 到 ${newLevel}`);
        
        character.importance = newLevel;
        character.lastUpdated = new Date().toISOString();
        
        // 更新人物详细信息
        this.plugin.generateDetailInfo(newLevel, character.basicInfo).then(detailInfo => {
            character.detailInfo = detailInfo;
            this.plugin.worldBookManager.createCharacterEntry(character);
        });

        this.plugin.showNotification(
            `${character.name} 已升级为${this.plugin.importanceLevels[newLevel].name}！`,
            'success'
        );
    }
}

// 用户界面管理器
class UIManager {
    constructor(plugin) {
        this.plugin = plugin;
    }

    createUI() {
        // 创建控制面板
        const panel = $(`
            <div id="lcs-control-panel" class="lcs-panel">
                <h3>分层人物世界书系统</h3>
                <div class="lcs-stats">
                    <div class="lcs-stat">
                        <span class="lcs-stat-label">总人物数:</span>
                        <span class="lcs-stat-value" id="lcs-total-characters">0</span>
                    </div>
                    <div class="lcs-stat">
                        <span class="lcs-stat-label">主要人物:</span>
                        <span class="lcs-stat-value" id="lcs-main-characters">0</span>
                    </div>
                    <div class="lcs-stat">
                        <span class="lcs-stat-label">次要人物:</span>
                        <span class="lcs-stat-value" id="lcs-secondary-characters">0</span>
                    </div>
                    <div class="lcs-stat">
                        <span class="lcs-stat-label">背景人物:</span>
                        <span class="lcs-stat-value" id="lcs-background-characters">0</span>
                    </div>
                </div>
                <div class="lcs-controls">
                    <button id="lcs-toggle-enabled" class="lcs-button">启用系统</button>
                    <button id="lcs-show-index" class="lcs-button">显示索引</button>
                    <button id="lcs-settings" class="lcs-button">设置</button>
                </div>
                <div class="lcs-character-list" id="lcs-character-list"></div>
            </div>
        `);

        $('body').append(panel);
        this.setupEventListeners();
        this.updateStats();
    }

    setupEventListeners() {
        $('#lcs-toggle-enabled').on('click', () => {
            this.plugin.settings.enabled = !this.plugin.settings.enabled;
            this.plugin.saveSettings();
            $('#lcs-toggle-enabled').text(this.plugin.settings.enabled ? '禁用系统' : '启用系统');
            this.plugin.showNotification(
                `系统已${this.plugin.settings.enabled ? '启用' : '禁用'}`,
                'info'
            );
        });

        $('#lcs-show-index').on('click', () => {
            this.plugin.handleIndexQuery('显示人物索引');
        });

        $('#lcs-settings').on('click', () => {
            this.showSettingsDialog();
        });
    }

    updateStats() {
        const stats = this.plugin.getCharacterStats();
        $('#lcs-total-characters').text(stats.total);
        $('#lcs-main-characters').text(stats.main);
        $('#lcs-secondary-characters').text(stats.secondary);
        $('#lcs-background-characters').text(stats.background);
        
        // 更新人物列表
        this.updateCharacterList();
    }

    updateCharacterList() {
        const listContainer = $('#lcs-character-list');
        listContainer.empty();
        
        this.plugin.characterIndex.forEach(character => {
            const item = $(`
                <div class="lcs-character-item" data-id="${character.id}">
                    <div class="lcs-character-name">${character.name}</div>
                    <div class="lcs-character-info">
                        <span class="lcs-character-occupation">${character.occupation}</span>
                        <span class="lcs-character-importance ${character.importance}">${this.plugin.importanceLevels[character.importance].name}</span>
                    </div>
                </div>
            `);
            
            item.on('click', () => {
                this.showCharacterDetails(character.id);
            });
            
            listContainer.append(item);
        });
    }

    showCharacterDetails(characterId) {
        const character = this.plugin.characters.get(characterId);
        if (!character) return;
        
        const details = $(`
            <div class="lcs-character-details">
                <h3>${character.name}</h3>
                <div class="lcs-detail-section">
                    <h4>基本信息</h4>
                    <p><strong>重要性:</strong> ${this.plugin.importanceLevels[character.importance].name}</p>
                    <p><strong>职业:</strong> ${character.basicInfo.occupation}</p>
                    <p><strong>位置:</strong> ${character.basicInfo.location}</p>
                    <p><strong>交互次数:</strong> ${character.interactionCount}</p>
                </div>
                <div class="lcs-detail-section">
                    <h4>性格特征</h4>
                    <p>${character.detailInfo.personality || '暂无信息'}</p>
                </div>
                <div class="lcs-detail-section">
                    <h4>背景故事</h4>
                    <p>${character.detailInfo.background || '暂无信息'}</p>
                </div>
                <button class="lcs-close-details">关闭</button>
            </div>
        `);
        
        $('body').append(details);
        $('.lcs-close-details').on('click', () => {
            details.remove();
        });
    }

    showSettingsDialog() {
        const dialog = $(`
            <div class="lcs-settings-dialog">
                <h3>系统设置</h3>
                <div class="lcs-setting">
                    <label>自动生成人物</label>
                    <input type="checkbox" id="lcs-setting-auto-generate" ${this.plugin.settings.autoGenerate ? 'checked' : ''}>
                </div>
                <div class="lcs-setting">
                    <label>最大主要人物数</label>
                    <input type="number" id="lcs-setting-max-main" value="${this.plugin.settings.maxMainCharacters}" min="1" max="10">
                </div>
                <div class="lcs-setting">
                    <label>最大次要人物数</label>
                    <input type="number" id="lcs-setting-max-secondary" value="${this.plugin.settings.maxSecondaryCharacters}" min="1" max="20">
                </div>
                <div class="lcs-setting">
                    <label>最大背景人物数</label>
                    <input type="number" id="lcs-setting-max-background" value="${this.plugin.settings.maxBackgroundCharacters}" min="1" max="50">
                </div>
                <div class="lcs-setting">
                    <label>Token预算</label>
                    <input type="number" id="lcs-setting-token-budget" value="${this.plugin.settings.tokenBudget}" min="500" max="5000" step="100">
                </div>
                <div class="lcs-setting">
                    <label>启用成长系统</label>
                    <input type="checkbox" id="lcs-setting-enable-growth" ${this.plugin.settings.enableGrowthSystem ? 'checked' : ''}>
                </div>
                <div class="lcs-dialog-buttons">
                    <button id="lcs-save-settings" class="lcs-button">保存</button>
                    <button id="lcs-cancel-settings" class="lcs-button">取消</button>
                </div>
            </div>
        `);
        
        $('body').append(dialog);
        
        $('#lcs-save-settings').on('click', () => {
            this.plugin.settings.autoGenerate = $('#lcs-setting-auto-generate').is(':checked');
            this.plugin.settings.maxMainCharacters = parseInt($('#lcs-setting-max-main').val());
            this.plugin.settings.maxSecondaryCharacters = parseInt($('#lcs-setting-max-secondary').val());
            this.plugin.settings.maxBackgroundCharacters = parseInt($('#lcs-setting-max-background').val());
            this.plugin.settings.tokenBudget = parseInt($('#lcs-setting-token-budget').val());
            this.plugin.settings.enableGrowthSystem = $('#lcs-setting-enable-growth').is(':checked');
            
            this.plugin.saveSettings();
            this.plugin.showNotification('设置已保存', 'success');
            dialog.remove();
        });
        
        $('#lcs-cancel-settings').on('click', () => {
            dialog.remove();
        });
    }

    updateCharacterGrowthUI(characterId) {
        // 更新人物成长相关的UI
        console.log(`更新人物成长UI: ${characterId}`);
    }

    showMilestoneNotification(characterId, milestones) {
        const character = this.plugin.characters.get(characterId);
        if (!character) return;
        
        let message = `${character.name} 达成里程碑！\n`;
        milestones.forEach(milestone => {
            message += `- ${milestone.description}\n`;
        });
        
        this.plugin.showNotification(message, 'milestone');
    }
}

// 人物成长系统
class CharacterGrowthSystem {
    constructor() {
        this.growthTypes = {
            skills: '技能',
            knowledge: '知识',
            relationships: '关系',
            mentality: '心态',
            status: '地位'
        };
        
        this.growthEvents = {
            success: { skills: 0.3, knowledge: 0.2, mentality: 0.4, status: 0.3 },
            failure: { skills: 0.1, knowledge: 0.3, mentality: 0.5, status: -0.2 },
            relationship: { relationships: 0.5, mentality: 0.2 },
            challenge: { skills: 0.2, knowledge: 0.1, mentality: 0.4 },
            learning: { knowledge: 0.5, skills: 0.2 },
            conflict: { relationships: -0.3, mentality: 0.3, skills: 0.2 }
        };
    }

    initializeCharacterGrowth(character) {
        return {
            skills: this.initializeGrowthArea(),
            knowledge: this.initializeGrowthArea(),
            relationships: this.initializeGrowthArea(),
            mentality: this.initializeGrowthArea(),
            status: this.initializeGrowthArea(),
            milestones: [],
            lastGrowthTime: Date.now()
        };
    }

    initializeGrowthArea() {
        return {
            level: 1.0,
            experience: 0,
            growthRate: 1.0,
            recentEvents: []
        };
    }

    async processGrowthEvent(character, event) {
        if (!character.growthData) {
            character.growthData = this.initializeCharacterGrowth(character);
        }

        const growthData = character.growthData;
        const eventEffects = this.growthEvents[event.type] || {};
        const changes = [];
        let growthOccurred = false;

        // 处理每个成长领域的变化
        Object.keys(eventEffects).forEach(area => {
            if (growthData[area]) {
                const effect = eventEffects[area] * event.intensity;
                const oldLevel = growthData[area].level;
                
                // 应用成长效果
                growthData[area].experience += Math.abs(effect);
                growthData[area].level += effect * 0.1;
                growthData[area].level = Math.max(0.1, Math.min(10.0, growthData[area].level));
                
                // 记录事件
                growthData[area].recentEvents.push({
                    type: event.type,
                    effect: effect,
                    timestamp: Date.now()
                });
                
                // 只保留最近10个事件
                if (growthData[area].recentEvents.length > 10) {
                    growthData[area].recentEvents.shift();
                }
                
                // 检查是否有显著变化
                if (Math.abs(growthData[area].level - oldLevel) > 0.1) {
                    changes.push({
                        area: area,
                        oldLevel: oldLevel,
                        newLevel: growthData[area].level,
                        growthType: this.determineGrowthType(effect)
                    });
                    growthOccurred = true;
                }
            }
        });

        // 检查里程碑
        if (growthOccurred) {
            const newMilestones = this.checkMilestones(character);
            if (newMilestones.length > 0) {
                growthData.milestones.push(...newMilestones);
                $(document).trigger('character_milestones_achieved', [character.id, newMilestones]);
            }
        }

        // 保存成长数据
        $(document).trigger('character_growth_saved', [character.id, growthData]);

        return {
            growthOccurred: growthOccurred,
            changes: changes,
            milestones: newMilestones || []
        };
    }

    determineGrowthType(effect) {
        if (effect > 0.3) return 'breakthrough';
        if (effect > 0.1) return 'gradual';
        if (effect < -0.1) return 'temporary_setback';
        return 'stable';
    }

    checkMilestones(character) {
        const growthData = character.growthData;
        const milestones = [];
        
        // 检查各个领域的里程碑
        Object.keys(growthData).forEach(area => {
            if (area === 'milestones' || area === 'lastGrowthTime') return;
            
            const areaData = growthData[area];
            const level = areaData.level;
            
            // 定义里程碑
            const milestoneLevels = [2.0, 5.0, 8.0];
            
            milestoneLevels.forEach(milestoneLevel => {
                if (level >= milestoneLevel && !growthData.milestones.some(m => 
                    m.area === area && m.level === milestoneLevel)) {
                    
                    milestones.push({
                        area: area,
                        level: milestoneLevel,
                        description: `${this.growthTypes[area]}达到${milestoneLevel}级`,
                        timestamp: Date.now()
                    });
                }
            });
        });
        
        return milestones;
    }

    getGrowthReport(character) {
        if (!character.growthData) {
            return { error: '该人物没有成长数据' };
        }
        
        const growthData = character.growthData;
        const report = {
            character: character.name,
            areas: {},
            milestones: growthData.milestones,
            summary: ''
        };
        
        // 生成各领域报告
        Object.keys(this.growthTypes).forEach(area => {
            if (growthData[area]) {
                report.areas[area] = {
                    name: this.growthTypes[area],
                    level: growthData[area].level.toFixed(1),
                    experience: growthData[area].experience.toFixed(0),
                    recentEvents: growthData[area].recentEvents.slice(-3)
                };
            }
        });
        
        // 生成总结
        const totalLevels = Object.keys(report.areas).reduce((sum, area) => 
            sum + parseFloat(report.areas[area].level), 0);
        const avgLevel = totalLevels / Object.keys(report.areas).length;
        
        report.summary = `总体成长水平: ${avgLevel.toFixed(1)}级`;
        
        return report;
    }
}

// 世界设定检测器
class WorldSettingDetector {
    constructor() {
        this.worldSettings = {
            modern: {
                name: '现代都市',
                keywords: ['现代', '都市', '城市', '公司', '手机', '电脑', '汽车', '地铁'],
                allowedOccupations: ['白领', '医生', '律师', '教师', '警察', '商人', '艺术家', '学生'],
                allowedBackgrounds: ['城市出身', '中产家庭', '富裕家庭', '普通家庭', '移民家庭'],
                forbiddenElements: ['魔法', '恶魔', '精灵', '龙', '修仙', '武功'],
                technologyLevel: 'modern',
                socialStructure: 'contemporary'
            },
            fantasy: {
                name: '奇幻世界',
                keywords: ['魔法', '精灵', '矮人', '龙', '骑士', '城堡', '剑与魔法'],
                allowedOccupations: ['法师', '战士', '牧师', '盗贼', '商人', '铁匠', '药师', '吟游诗人'],
                allowedBackgrounds: ['贵族出身', '平民出身', '孤儿', '流浪者', '学徒'],
                forbiddenElements: ['手机', '电脑', '汽车', '枪械', '现代科技'],
                technologyLevel: 'pre-industrial',
                socialStructure: 'feudal'
            },
            scifi: {
                name: '科幻未来',
                keywords: ['未来', '太空', '星际', '机器人', 'AI', '飞船', '激光', '外星人'],
                allowedOccupations: ['科学家', '工程师', '宇航员', '机器人', 'AI专家', '太空商人', '星际警察'],
                allowedBackgrounds: ['地球出身', '殖民地出身', '太空站出身', '实验室出身'],
                forbiddenElements: ['魔法', '中世纪', '骑士', '城堡', '传统魔法'],
                technologyLevel: 'advanced',
                socialStructure: 'futuristic'
            },
            historical: {
                name: '历史古代',
                keywords: ['古代', '历史', '王朝', '皇帝', '将军', '传统', '古典'],
                allowedOccupations: ['官员', '将军', '商人', '学者', '工匠', '农民', '医生', '艺人'],
                allowedBackgrounds: ['贵族', '士族', '平民', '商人家庭', '书香门第'],
                forbiddenElements: ['现代科技', '魔法', '外星人', '机器人'],
                technologyLevel: 'pre-modern',
                socialStructure: 'traditional'
            }
        };
        
        this.currentSetting = null;
        this.confidence = 0;
    }

    detectWorldSetting(context) {
        const scores = {};
        
        // 计算每个设定的得分
        Object.keys(this.worldSettings).forEach(settingKey => {
            const setting = this.worldSettings[settingKey];
            scores[settingKey] = this.calculateSettingScore(setting, context);
        });
        
        // 找到得分最高的设定
        const bestSetting = Object.keys(scores).reduce((a, b) => 
            scores[a] > scores[b] ? a : b
        );
        
        this.currentSetting = bestSetting;
        this.confidence = scores[bestSetting];
        
        console.log(`检测到世界设定: ${this.worldSettings[bestSetting].name} (置信度: ${this.confidence})`);
        
        return {
            setting: bestSetting,
            confidence: this.confidence,
            details: this.worldSettings[bestSetting]
        };
    }

    calculateSettingScore(setting, context) {
        let score = 0;
        const message = context.message.toLowerCase();
        
        // 关键词匹配得分
        setting.keywords.forEach(keyword => {
            if (message.includes(keyword.toLowerCase())) {
                score += 10;
            }
        });
        
        // 禁忌元素检测（减分）
        setting.forbiddenElements.forEach(element => {
            if (message.includes(element.toLowerCase())) {
                score -= 20;
            }
        });
        
        return Math.max(0, score);
    }

    getCurrentSetting() {
        return this.currentSetting ? this.worldSettings[this.currentSetting] : null;
    }

    validateCharacterForWorld(character, worldSetting) {
        const issues = [];
        
        // 检查职业
        if (!worldSetting.allowedOccupations.includes(character.basicInfo.occupation)) {
            issues.push(`职业 "${character.basicInfo.occupation}" 不符合 ${worldSetting.name} 设定`);
        }
        
        // 检查背景
        if (!worldSetting.allowedBackgrounds.some(bg => 
            character.detailInfo.background.includes(bg)
        )) {
            issues.push(`背景 "${character.detailInfo.background}" 不符合 ${worldSetting.name} 设定`);
        }
        
        // 检查是否包含禁忌元素
        worldSetting.forbiddenElements.forEach(element => {
            if (character.detailInfo.background.includes(element) ||
                character.detailInfo.story?.includes(element)) {
                issues.push(`包含禁忌元素 "${element}"`);
            }
        });
        
        return {
            valid: issues.length === 0,
            issues: issues
        };
    }

    getAllowedOccupations() {
        const setting = this.getCurrentSetting();
        return setting ? setting.allowedOccupations : [];
    }

    getAllowedBackgrounds() {
        const setting = this.getCurrentSetting();
        return setting ? setting.allowedBackgrounds : [];
    }
}

// 复杂性格分析引擎
class ComplexPersonalityEngine {
    constructor() {
        // 性格维度（基于大五人格理论+文化维度）
        this.personalityDimensions = {
            openness: {      // 开放性
                name: '开放性',
                range: ['封闭保守', '传统务实', '平衡', '好奇探索', '创新开放'],
                influences: {}
            },
            conscientiousness: { // 尽责性
                name: '尽责性',
                range: ['随意散漫', '灵活变通', '平衡', '有条理', '完美主义'],
                influences: {}
            },
            extraversion: {    // 外向性
                name: '外向性',
                range: ['内向安静', '温和内敛', '平衡', '善于交际', '热情外向'],
                influences: {}
            },
            agreeableness: {   // 宜人性
                name: '宜人性',
                range: ['批判怀疑', '理性独立', '平衡', '合作友善', '利他奉献'],
                influences: {}
            },
            neuroticism: {     // 神经质
                name: '情绪稳定性',
                range: ['情绪稳定', '冷静理性', '平衡', '敏感易感', '情绪波动'],
                influences: {}
            }
        };
        
        // 环境影响的复杂性
        this.environmentalInfluences = {
            familyBackground: {
                '富裕家庭': {
                    positivePressures: {
                        '高期望压力': ['完美主义', '焦虑', '自我怀疑'],
                        '社交压力': ['表面自信', '内心孤独', '社交面具'],
                        '成就压力': ['竞争性强', '害怕失败', '过度努力']
                    },
                    positiveAdvantages: {
                        '资源丰富': ['视野开阔', '自信', '有教养'],
                        '教育优质': ['知识渊博', '思维敏捷', '有品位'],
                        '社会网络': ['善于社交', '有影响力', '资源整合能力']
                    },
                    negativeRisks: {
                        '过度保护': ['依赖性强', '缺乏独立性', '抗压能力差'],
                        '物质丰富': ['物质主义', '缺乏奋斗精神', '价值观扭曲'],
                        '特权思想': ['傲慢', '缺乏同理心', '脱离现实']
                    },
                    personalityPatterns: [
                        {
                            pattern: '完美主义者',
                            traits: ['完美主义', '高要求', '自我批评', '焦虑'],
                            likelihood: 0.3,
                            description: '在高压环境下追求完美，内心敏感'
                        },
                        {
                            pattern: '纨绔子弟',
                            traits: ['傲慢', '物质主义', '缺乏同理心', '依赖性强'],
                            likelihood: 0.2,
                            description: '在物质丰富中成长，缺乏奋斗精神'
                        },
                        {
                            pattern: '优雅精英',
                            traits: ['自信', '有教养', '视野开阔', '有领导力'],
                            likelihood: 0.25,
                            description: '充分利用家庭优势，全面发展'
                        },
                        {
                            pattern: '反叛者',
                            traits: ['反叛', '独立思考', '敏感', '追求真实'],
                            likelihood: 0.15,
                            description: '反抗家庭期望，寻找自我价值'
                        },
                        {
                            pattern: '社会责任者',
                            traits: ['有责任感', '利他', '有同情心', '有使命感'],
                            likelihood: 0.1,
                            description: '认识到特权，希望回馈社会'
                        }
                    ]
                },
                
                '普通家庭': {
                    positivePressures: {
                        '现实压力': ['务实', '勤奋', '有责任感'],
                        '竞争压力': ['渴望成功', '焦虑', '上进心'],
                        '家庭期望': ['孝顺', '责任感', '家庭观念重']
                    },
                    positiveAdvantages: {
                        '真实环境': ['脚踏实地', '适应力强', '现实感强'],
                        '平衡教育': ['价值观平衡', '独立性', '自理能力强'],
                        '社会体验': ['了解社会', '人际关系真实', '情商高']
                    },
                    negativeRisks: {
                        '资源有限': ['视野局限', '机会不均', '自卑可能'],
                        '压力过大': ['焦虑', '急功近利', '价值观偏差'],
                        '环境限制': ['格局有限', '思维保守', '创新不足']
                    },
                    personalityPatterns: [
                        {
                            pattern: '奋斗者',
                            traits: ['勤奋', '上进', '务实', '有韧性'],
                            likelihood: 0.35,
                            description: '通过努力改变命运，坚韧不拔'
                        },
                        {
                            pattern: '现实主义者',
                            traits: ['务实', '理性', '脚踏实地', '适应力强'],
                            likelihood: 0.25,
                            description: '清楚认识现实，理性规划人生'
                        },
                        {
                            pattern: '焦虑者',
                            traits: ['焦虑', '急躁', '渴望成功', '压力敏感'],
                            likelihood: 0.2,
                            description: '在现实压力下产生焦虑和紧迫感'
                        },
                        {
                            pattern: '满足者',
                            traits: ['知足', '平和', '家庭观念重', '稳定'],
                            likelihood: 0.15,
                            description: '满足于现状，重视家庭和稳定'
                        },
                        {
                            pattern: '创新者',
                            traits: ['创新', '突破思维', '不服输', '有野心'],
                            likelihood: 0.05,
                            description: '不满足于环境，寻求突破和创新'
                        }
                    ]
                },
                
                '困难家庭': {
                    positivePressures: {
                        '生存压力': ['坚韧', '独立', '早熟'],
                        '环境压力': ['警惕', '敏感', '自我保护'],
                        '责任压力': ['责任感强', '家庭观念重', '牺牲精神']
                    },
                    positiveAdvantages: {
                        '逆境锻炼': ['坚韧不拔', '抗压能力强', '适应力强'],
                        '早期独立': ['独立性强', '自理能力强', '成熟早'],
                        '真实体验': ['了解社会底层', '同理心强', '价值观真实']
                    },
                    negativeRisks: {
                        '资源匮乏': ['视野局限', '机会缺失', '自卑可能'],
                        '环境恶劣': ['价值观偏差', '行为极端', '信任问题'],
                        '心理创伤': ['心理阴影', '情绪问题', '人际关系障碍']
                    },
                    personalityPatterns: [
                        {
                            pattern: '坚韧战士',
                            traits: ['坚韧', '独立', '有韧性', '责任心强'],
                            likelihood: 0.3,
                            description: '在逆境中成长，性格坚韧，独立性强'
                        },
                        {
                            pattern: '敏感观察者',
                            traits: ['敏感', '观察力强', '警惕', '内心丰富'],
                            likelihood: 0.25,
                            description: '对环境敏感，观察力强，内心世界丰富'
                        },
                        {
                            pattern: '愤怒反叛者',
                            traits: ['愤怒', '反叛', '不信任', '防御性强'],
                            likelihood: 0.2,
                            description: '对环境充满愤怒，反叛意识强'
                        },
                        {
                            pattern: '自卑逃避者',
                            traits: ['自卑', '逃避', '缺乏自信', '消极'],
                            likelihood: 0.15,
                            description: '在困难中失去自信，产生自卑心理'
                        },
                        {
                            pattern: '理想主义者',
                            traits: ['理想主义', '追求美好', '有创造力', '敏感'],
                            likelihood: 0.1,
                            description: '在困难中保持理想，追求美好生活'
                        }
                    ]
                }
            },
            
            occupation: {
                '领导者': {
                    positiveAspects: {
                        '权力影响': ['有领导力', '决策力强', '有影响力'],
                        '责任锻炼': ['责任心强', '有担当', '成熟稳重'],
                        '视野开阔': ['有远见', '格局大', '战略思维']
                    },
                    negativeAspects: {
                        '压力负担': ['压力大', '焦虑', '孤独感'],
                        '权力腐蚀': ['傲慢', '脱离群众', '权力欲'],
                        '决策风险': ['优柔寡断', '害怕失败', '责任恐惧']
                    },
                    internalConflicts: [
                        {
                            conflict: '权威与亲和',
                            description: '在保持权威和亲和力之间的挣扎',
                            manifestations: ['时而严厉时而温和', '内心孤独但表面亲切']
                        },
                        {
                            conflict: '决策与犹豫',
                            description: '需要果断决策但内心充满不确定',
                            manifestations: ['表面果断内心焦虑', '过度思考']
                        }
                    ]
                },
                
                '专业人士': {
                    positiveAspects: {
                        '专业成长': ['专业能力强', '思维严谨', '有深度'],
                        '理性训练': ['理性思维', '逻辑性强', '客观分析'],
                        '社会认可': ['有地位', '受尊重', '有成就感']
                    },
                    negativeAspects: {
                        '专业局限': ['视野局限', '过度专业', '缺乏通识'],
                        '理性极端': ['情感压抑', '缺乏人情味', '刻板'],
                        '完美主义': ['过度要求', '焦虑', '不满足']
                    },
                    internalConflicts: [
                        {
                            conflict: '专业与人性',
                            description: '专业理性与人性情感的冲突',
                            manifestations: ['表面理性内心感性', '职业倦怠']
                        },
                        {
                            conflict: '深度与广度',
                            description: '专业深度与知识广度的平衡',
                            manifestations: ['专业自信与视野焦虑并存']
                        }
                    ]
                }
            }
        };
        
        // 性格矛盾和复杂性
        this.personalityComplexities = {
            contradictions: [
                {
                    type: '自信与自卑',
                    description: '表面自信但内心自卑，或特定领域自信其他领域自卑',
                    causes: ['高压环境', '比较心理', '完美主义'],
                    manifestations: ['公开场合自信私下焦虑', '成功时自信失败时自卑']
                },
                {
                    type: '独立与依赖',
                    description: '追求独立但内心渴望依赖，或某些方面独立某些方面依赖',
                    causes: ['早期教育', '依恋关系', '生活经历'],
                    manifestations: ['工作独立生活依赖', '情感独立物质依赖']
                },
                {
                    type: '理性与感性',
                    description: '理性思维但感性决策，或不同情境下表现不同',
                    causes: ['专业训练', '性格本质', '生活经验'],
                    manifestations: ['工作理性生活感性', '思考理性行动感性']
                }
            ],
            
            masks: [
                {
                    type: '社交面具',
                    description: '在社交场合表现出的与内心不同的性格',
                    purposes: ['保护自己', '获得认可', '职业需要'],
                    maintenanceCost: ['心理疲劳', '真实感缺失', '关系肤浅']
                },
                {
                    type: '职业面具',
                    description: '工作环境中需要的专业形象',
                    purposes: ['职业要求', '形象管理', '效率需要'],
                    maintenanceCost: ['职业倦怠', '真实自我压抑', '角色混淆']
                }
            ],
            
            growthPatterns: [
                {
                    type: '逆境成长',
                    description: '在困难中变得更加坚强和成熟',
                    triggers: ['重大挫折', '生活危机', '失败经历'],
                    outcomes: ['韧性增强', '智慧增长', '价值观重塑']
                },
                {
                    type: '舒适退化',
                    description: '在舒适环境中变得软弱和停滞',
                    triggers: ['长期舒适', '缺乏挑战', '过度保护'],
                    outcomes: ['能力退化', '意志薄弱', '应对能力下降']
                }
            ]
        };
    }

    generateComplexCharacter(character) {
        const { basicInfo, detailInfo } = character;
        
        // 1. 分析环境影响的多面性
        const environmentalAnalysis = this.analyzeEnvironmentalInfluences(detailInfo.background, basicInfo.occupation);
        
        // 2. 生成核心性格维度
        const coreDimensions = this.generateCoreDimensions(environmentalAnalysis);
        
        // 3. 添加性格矛盾和复杂性
        const complexities = this.addPersonalityComplexities(coreDimensions, environmentalAnalysis);
        
        // 4. 生成表面和深层性格
        const personalityLayers = this.generatePersonalityLayers(coreDimensions, complexities);
        
        // 5. 生成成长背景和经历影响
        const developmentalInfluences = this.generateDevelopmentalInfluences(basicInfo, detailInfo);
        
        return {
            corePersonality: this.formatCorePersonality(coreDimensions),
            surfaceTraits: personalityLayers.surface,
            depthTraits: personalityLayers.depth,
            contradictions: complexities.contradictions,
            masks: complexities.masks,
            developmentalInfluences: developmentalInfluences,
            behavioralPatterns: this.generateBehavioralPatterns(coreDimensions, complexities),
            motivationStructure: this.generateMotivationStructure(coreDimensions, environmentalAnalysis),
            stressResponses: this.generateStressResponses(coreDimensions, complexities),
            relationshipPatterns: this.generateRelationshipPatterns(coreDimensions, complexities),
            growthPotential: this.generateGrowthPotential(coreDimensions, complexities)
        };
    }

    analyzeEnvironmentalInfluences(background, occupation) {
        const influences = {
            family: this.analyzeFamilyInfluence(background),
            occupation: this.analyzeOccupationInfluence(occupation),
            interactions: [],
            conflicts: [],
            advantages: [],
            challenges: []
        };
        
        // 分析家庭背景的复杂影响
        Object.keys(this.environmentalInfluences.familyBackground).forEach(bgType => {
            if (background.includes(bgType)) {
                const bgData = this.environmentalInfluences.familyBackground[bgType];
                
                // 添加正面压力
                Object.keys(bgData.positivePressures).forEach(pressure => {
                    influences.interactions.push({
                        type: 'pressure',
                        category: 'positive',
                        source: pressure,
                        effects: bgData.positivePressures[pressure]
                    });
                });
                
                // 添加负面风险
                Object.keys(bgData.negativeRisks).forEach(risk => {
                    influences.interactions.push({
                        type: 'risk',
                        category: 'negative',
                        source: risk,
                        effects: bgData.negativeRisks[risk]
                    });
                });
                
                // 添加优势
                Object.keys(bgData.positiveAdvantages).forEach(advantage => {
                    influences.advantages.push({
                        source: advantage,
                        effects: bgData.positiveAdvantages[advantage]
                    });
                });
                
                // 添加挑战
                Object.keys(bgData.negativeRisks).forEach(challenge => {
                    influences.challenges.push({
                        source: challenge,
                        effects: bgData.negativeRisks[challenge]
                    });
                });
                
                // 添加可能的性格模式
                if (bgData.personalityPatterns) {
                    influences.patterns = bgData.personalityPatterns;
                }
            }
        });
        
        // 分析职业的复杂影响
        Object.keys(this.environmentalInfluences.occupation).forEach(occType => {
            if (occupation.includes(occType) || occType.includes(occupation)) {
                const occData = this.environmentalInfluences.occupation[occType];
                
                // 添加职业冲突
                if (occData.internalConflicts) {
                    influences.conflicts.push(...occData.internalConflicts);
                }
                
                influences.occupation = {
                    positive: occData.positiveAspects,
                    negative: occData.negativeAspects,
                    conflicts: occData.internalConflicts
                };
            }
        });
        
        return influences;
    }

    analyzeFamilyInfluence(background) {
        let influence = {
            factors: [],
            likelyTraits: [],
            unlikelyTraits: [],
            weight: 0.3 // 权重
        };
        
        // 检测家庭背景类型
        Object.keys(this.environmentalInfluences.familyBackground).forEach(bgType => {
            if (background.includes(bgType)) {
                const rules = this.environmentalInfluences.familyBackground[bgType];
                influence.likelyTraits.push(...rules.likely);
                influence.unlikelyTraits.push(...rules.unlikely);
                influence.factors.push({
                    type: 'family_background',
                    value: bgType,
                    rules: rules
                });
            }
        });
        
        return influence;
    }

    analyzeOccupationInfluence(occupation) {
        let influence = {
            factors: [],
            likelyTraits: [],
            unlikelyTraits: [],
            weight: 0.25
        };
        
        // 检测职业类型
        Object.keys(this.environmentalInfluences.occupation).forEach(occType => {
            if (occupation.includes(occType) || occType.includes(occupation)) {
                const rules = this.environmentalInfluences.occupation[occType];
                influence.likelyTraits.push(...rules.likely);
                influence.unlikelyTraits.push(...rules.unlikely);
                influence.factors.push({
                    type: 'occupation',
                    value: occType,
                    rules: rules
                });
            }
        });
        
        return influence;
    }

    generateCoreDimensions(environmentalAnalysis) {
        const dimensions = {};
        
        Object.keys(this.personalityDimensions).forEach(dimKey => {
            const dimension = this.personalityDimensions[dimKey];
            
            // 基于环境影响计算每个维度的倾向性
            const score = this.calculateDimensionScore(dimKey, environmentalAnalysis);
            
            // 将分数映射到性格范围
            const rangeIndex = Math.floor(Math.abs(score) * 4); // 0-4
            const clampedIndex = Math.max(0, Math.min(4, rangeIndex));
            
            dimensions[dimKey] = {
                score: score,
                level: dimension.range[clampedIndex],
                rawScore: score,
                influences: this.getDimensionInfluences(dimKey, environmentalAnalysis)
            };
        });
        
        return dimensions;
    }

    calculateDimensionScore(dimension, environmentalAnalysis) {
        let score = 0; // -1 到 1 之间
        
        // 基于环境影响调整分数
        environmentalAnalysis.interactions.forEach(interaction => {
            if (interaction.type === 'pressure') {
                // 压力对各个维度的影响
                const pressureEffects = this.getPressureEffects(dimension, interaction);
                score += pressureEffects;
            }
        });
        
        // 添加随机性（个体差异）
        score += (Math.random() - 0.5) * 0.6;
        
        // 基于优势调整
        environmentalAnalysis.advantages.forEach(advantage => {
            const advantageEffects = this.getAdvantageEffects(dimension, advantage);
            score += advantageEffects;
        });
        
        // 基于挑战调整
        environmentalAnalysis.challenges.forEach(challenge => {
            const challengeEffects = this.getChallengeEffects(dimension, challenge);
            score += challengeEffects;
        });
        
        // 确保分数在合理范围内
        return Math.max(-1, Math.min(1, score));
    }

    getPressureEffects(dimension, pressure) {
        const effects = {
            openness: {
                '高期望压力': -0.2, // 高期望可能降低开放性
                '社交压力': 0.1,   // 社交压力可能增加开放性
                '生存压力': -0.1,  // 生存压力可能降低开放性
                '现实压力': -0.15  // 现实压力可能让人更保守
            },
            conscientiousness: {
                '高期望压力': 0.3,  // 高期望通常增加尽责性
                '责任压力': 0.25,  // 责任压力增加尽责性
                '现实压力': 0.2,   // 现实压力增加尽责性
                '竞争压力': 0.15   // 竞争压力增加尽责性
            },
            extraversion: {
                '社交压力': 0.2,   // 社交压力可能增加外向性
                '高期望压力': -0.1, // 高期望可能降低外向性
                '生存压力': -0.15, // 生存压力可能让人更内向
                '环境压力': -0.1   // 环境压力可能降低外向性
            },
            agreeableness: {
                '社交压力': 0.15,  // 社交压力可能增加宜人性
                '责任压力': 0.1,   // 责任压力可能增加宜人性
                '高期望压力': -0.05 // 高期望可能降低宜人性
            },
            neuroticism: {
                '高期望压力': 0.3,  // 高期望增加神经质
                '社交压力': 0.25,  // 社交压力增加神经质
                '生存压力': 0.2,   // 生存压力增加神经质
                '环境压力': 0.15   // 环境压力增加神经质
            }
        };
        
        return effects[dimension][pressure.source] || 0;
    }

    addPersonalityComplexities(coreDimensions, environmentalAnalysis) {
        const complexities = {
            contradictions: [],
            masks: [],
            internalConflicts: []
        };
        
        // 基于环境冲突生成矛盾
        if (environmentalAnalysis.conflicts) {
            environmentalAnalysis.conflicts.forEach(conflict => {
                const contradiction = this.generateContradiction(conflict, coreDimensions);
                if (contradiction) {
                    complexities.contradictions.push(contradiction);
                }
            });
        }
        
        // 基于社交需求生成面具
        if (this.needsSocialMask(coreDimensions, environmentalAnalysis)) {
            const mask = this.generateSocialMask(coreDimensions);
            complexities.masks.push(mask);
        }
        
        // 基于职业需求生成职业面具
        if (environmentalAnalysis.occupation) {
            const occupationalMask = this.generateOccupationalMask(coreDimensions, environmentalAnalysis.occupation);
            complexities.masks.push(occupationalMask);
        }
        
        return complexities;
    }

    generateContradiction(conflict, coreDimensions) {
        const contradictionTypes = {
            '权威与亲和': {
                dimension1: 'extraversion',
                dimension2: 'agreeableness',
                description: conflict.description,
                manifestations: conflict.manifestations
            },
            '决策与犹豫': {
                dimension1: 'conscientiousness',
                dimension2: 'neuroticism',
                description: conflict.description,
                manifestations: conflict.manifestations
            }
        };
        
        const type = contradictionTypes[conflict.type];
        if (!type) return null;
        
        return {
            type: conflict.type,
            description: type.description,
            dimensions: [type.dimension1, type.dimension2],
            manifestations: type.manifestations,
            intensity: this.calculateContradictionIntensity(coreDimensions, type.dimensions),
            triggers: this.generateContradictionTriggers(type.dimensions)
        };
    }

    calculateContradictionIntensity(coreDimensions, dimensions) {
        const [dim1, dim2] = dimensions;
        const score1 = Math.abs(coreDimensions[dim1].score);
        const score2 = Math.abs(coreDimensions[dim2].score);
        
        return (score1 + score2) / 2;
    }

    generateContradictionTriggers(dimensions) {
        const [dim1, dim2] = dimensions;
        const triggers = {
            'extraversion': ['社交场合', '聚会', '演讲', '团队合作'],
            'agreeableness': ['冲突', '竞争', '谈判', '批评'],
            'conscientiousness': ['决策', '规划', '截止日期', '责任'],
            'neuroticism': ['压力', '批评', '失败', '不确定性']
        };
        
        return [...triggers[dim1], ...triggers[dim2]];
    }

    needsSocialMask(coreDimensions, environmentalAnalysis) {
        // 如果外向性适中且神经质较高，可能需要社交面具
        return coreDimensions.extraversion.score > -0.3 && 
               coreDimensions.extraversion.score < 0.3 &&
               coreDimensions.neuroticism.score > 0.2;
    }

    generateSocialMask(coreDimensions) {
        return {
            type: '社交面具',
            description: '在社交场合表现出与内心不同的性格',
            purposes: ['保护自己', '获得认可', '职业需要'],
            maintenanceCost: ['心理疲劳', '真实感缺失', '关系肤浅'],
            surfaceTraits: ['友善', '自信', '从容'],
            innerReality: coreDimensions.neuroticism.score > 0 ? '内心焦虑' : '内心平静'
        };
    }

    generateOccupationalMask(coreDimensions, occupationData) {
        return {
            type: '职业面具',
            description: '工作环境中需要的专业形象',
            purposes: ['职业要求', '形象管理', '效率需要'],
            maintenanceCost: ['职业倦怠', '真实自我压抑', '角色混淆'],
            surfaceTraits: ['专业', '理性', '高效'],
            innerReality: coreDimensions.neuroticism.score > 0 ? '内心压力' : '内心平衡'
        };
    }

    generatePersonalityLayers(coreDimensions, complexities) {
        return {
            surface: {
                traits: this.generateSurfaceTraits(coreDimensions),
                behaviors: this.generateSurfaceBehaviors(coreDimensions, complexities),
                socialPresentation: this.generateSocialPresentation(coreDimensions, complexities)
            },
            depth: {
                traits: this.generateDepthTraits(coreDimensions),
                motivations: this.generateDepthMotivations(coreDimensions),
                fears: this.generateDepthFears(coreDimensions, complexities),
                desires: this.generateDepthDesires(coreDimensions)
            }
        };
    }

    generateSurfaceTraits(coreDimensions) {
        const surfaceTraits = [];
        
        // 基于核心维度生成表面可见的特征
        if (coreDimensions.extraversion.score > 0.3) {
            surfaceTraits.push('善于交际', '表达流畅');
        } else if (coreDimensions.extraversion.score < -0.3) {
            surfaceTraits.push('安静', '内敛');
        }
        
        if (coreDimensions.conscientiousness.score > 0.3) {
            surfaceTraits.push('有条理', '可靠');
        } else if (coreDimensions.conscientiousness.score < -0.3) {
            surfaceTraits.push('随性', '灵活');
        }
        
        if (coreDimensions.agreeableness.score > 0.3) {
            surfaceTraits.push('友善', '合作');
        } else if (coreDimensions.agreeableness.score < -0.3) {
            surfaceTraits.push('独立', '批判');
        }
        
        return surfaceTraits;
    }

    generateSurfaceBehaviors(coreDimensions, complexities) {
        const behaviors = [];
        
        if (coreDimensions.extraversion.score > 0.5) {
            behaviors.push('主动参与社交活动');
        } else if (coreDimensions.extraversion.score < -0.5) {
            behaviors.push('避免社交场合，需要独处时间');
        }
        
        if (complexities.contradictions.length > 0) {
            complexities.contradictions.forEach(contradiction => {
                behaviors.push(`在${contradiction.triggers.join('或')}时表现出矛盾行为`);
            });
        }
        
        return behaviors;
    }

    generateSocialPresentation(coreDimensions, complexities) {
        let presentation = '自然真实';
        
        if (complexities.masks.length > 0) {
            presentation = '戴着社交面具，表现与内心不完全一致';
        }
        
        if (coreDimensions.agreeableness.score > 0.5) {
            presentation += '，给人友善亲切的印象';
        } else if (coreDimensions.agreeableness.score < -0.5) {
            presentation += '，给人独立批判的印象';
        }
        
        return presentation;
    }

    generateDepthTraits(coreDimensions) {
        const depthTraits = [];
        
        if (coreDimensions.neuroticism.score > 0.5) {
            depthTraits.push('内心敏感', '情绪波动大');
        } else if (coreDimensions.neuroticism.score < -0.5) {
            depthTraits.push('情绪稳定', '内心平静');
        }
        
        if (coreDimensions.openness.score > 0.5) {
            depthTraits.push('思维开放', '富有创造力');
        } else if (coreDimensions.openness.score < -0.5) {
            depthTraits.push('思维传统', '喜欢稳定');
        }
        
        return depthTraits;
    }

    generateDepthMotivations(coreDimensions) {
        const motivations = [];
        
        if (coreDimensions.extraversion.score > 0.3) {
            motivations.push('渴望社交连接', '寻求外部认可');
        }
        
        if (coreDimensions.conscientiousness.score > 0.3) {
            motivations.push('追求成就', '重视责任');
        }
        
        if (coreDimensions.openness.score > 0.3) {
            motivations.push('探索新事物', '追求成长');
        }
        
        return motivations;
    }

    generateDepthFears(coreDimensions, complexities) {
        const fears = [];
        
        if (coreDimensions.neuroticism.score > 0.3) {
            fears.push('害怕失败', '担心被拒绝', '恐惧不确定性');
        }
        
        if (complexities.contradictions.length > 0) {
            complexities.contradictions.forEach(contradiction => {
                fears.push(`害怕在${contradiction.type}方面暴露真实自我`);
            });
        }
        
        return fears;
    }

    generateDepthDesires(coreDimensions) {
        const desires = [];
        
        if (coreDimensions.agreeableness.score > 0.3) {
            desires.push('建立深厚关系', '帮助他人');
        }
        
        if (coreDimensions.openness.score > 0.3) {
            desires.push('追求自由', '实现自我价值');
        }
        
        if (coreDimensions.conscientiousness.score > 0.3) {
            desires.push('追求完美', '获得成就感');
        }
        
        return desires;
    }

    generateDevelopmentalInfluences(basicInfo, detailInfo) {
        return {
            childhood: {
                influences: this.generateChildhoodInfluences(detailInfo.background),
                formativeExperiences: this.generateFormativeExperiences(basicInfo.age, detailInfo.background),
                keyRelationships: this.generateKeyRelationships(detailInfo.background)
            },
            adulthood: {
                challenges: this.generateAdulthoodChallenges(basicInfo.occupation),
                achievements: this.generateAchievements(basicInfo.age, basicInfo.occupation),
                turningPoints: this.generateTurningPoints(basicInfo.age, detailInfo.story)
            }
        };
    }

    generateChildhoodInfluences(background) {
        const influences = [];
        
        if (background.includes('富裕家庭')) {
            influences.push('优越的教育资源', '较高的社会期望', '良好的生活条件');
        } else if (background.includes('困难家庭')) {
            influences.push('早期独立', '面对挑战', '资源匮乏');
        } else {
            influences.push('平衡的成长环境', '正常的家庭支持');
        }
        
        return influences;
    }

    generateFormativeExperiences(age, background) {
        const experiences = [];
        
        if (age < 25) {
            experiences.push('还在成长和学习阶段');
        } else if (age < 40) {
            experiences.push('已经积累了一定的人生经验');
        } else {
            experiences.push('拥有丰富的人生阅历');
        }
        
        if (background.includes('困难家庭')) {
            experiences.push('早期面对生活挑战');
        }
        
        return experiences;
    }

    generateKeyRelationships(background) {
        const relationships = [];
        
        if (background.includes('富裕家庭')) {
            relationships.push('与父母的关系复杂', '可能有兄弟姐妹竞争');
        } else if (background.includes('困难家庭')) {
            relationships.push('与家人关系紧密', '早期学会独立');
        } else {
            relationships.push('家庭关系和谐', '得到适当的支持');
        }
        
        return relationships;
    }

    generateAdulthoodChallenges(occupation) {
        const challenges = [];
        
        if (occupation.includes('领导')) {
            challenges.push('承担重大责任', '需要做困难决策');
        } else if (occupation.includes('专业')) {
            challenges.push('保持专业竞争力', '应对工作压力');
        } else {
            challenges.push('适应社会环境', '建立稳定生活');
        }
        
        return challenges;
    }

    generateAchievements(age, occupation) {
        const achievements = [];
        
        if (age > 30) {
            achievements.push('在职业领域有所建树');
        }
        
        if (occupation.includes('专业')) {
            achievements.push('获得专业认可');
        }
        
        return achievements;
    }

    generateTurningPoints(age, story) {
        const turningPoints = [];
        
        if (story && story.includes('重大')) {
            turningPoints.push('经历过重大人生转折');
        }
        
        if (age > 40) {
            turningPoints.push('人生观和价值观已经成熟');
        }
        
        return turningPoints;
    }

    generateBehavioralPatterns(coreDimensions, complexities) {
        const patterns = [];
        
        // 基于性格维度生成行为模式
        if (coreDimensions.extraversion.score > 0.5) {
            patterns.push({
                type: '社交活跃',
                description: '喜欢社交活动，在人群中感到舒适',
                triggers: ['聚会', '社交场合', '团队活动']
            });
        } else if (coreDimensions.extraversion.score < -0.5) {
            patterns.push({
                type: '独处充电',
                description: '需要独处时间来恢复精力',
                triggers: ['社交疲劳', '压力', '需要思考']
            });
        }
        
        // 基于矛盾生成复杂行为模式
        complexities.contradictions.forEach(contradiction => {
            patterns.push({
                type: '矛盾行为',
                description: `在${contradiction.type}方面的矛盾表现`,
                manifestations: contradiction.manifestations,
                triggers: contradiction.triggers
            });
        });
        
        return patterns;
    }

    generateMotivationStructure(coreDimensions, environmentalAnalysis) {
        return {
            primaryMotivations: this.generatePrimaryMotivations(coreDimensions),
            secondaryMotivations: this.generateSecondaryMotivations(environmentalAnalysis),
            conflicts: this.generateMotivationConflicts(coreDimensions, environmentalAnalysis)
        };
    }

    generatePrimaryMotivations(coreDimensions) {
        const motivations = [];
        
        if (coreDimensions.extraversion.score > 0.3) {
            motivations.push('社交连接', '影响力');
        }
        if (coreDimensions.openness.score > 0.3) {
            motivations.push('探索', '学习');
        }
        if (coreDimensions.conscientiousness.score > 0.3) {
            motivations.push('成就', '完美');
        }
        if (coreDimensions.agreeableness.score > 0.3) {
            motivations.push('和谐', '帮助他人');
        }
        
        return motivations;
    }

    generateSecondaryMotivations(environmentalAnalysis) {
        const motivations = [];
        
        environmentalAnalysis.advantages.forEach(advantage => {
            if (advantage.source === '资源丰富') {
                motivations.push('利用资源优势');
            }
        });
        
        environmentalAnalysis.challenges.forEach(challenge => {
            if (challenge.source === '资源匮乏') {
                motivations.push('克服资源限制');
            }
        });
        
        return motivations;
    }

    generateMotivationConflicts(coreDimensions, environmentalAnalysis) {
        const conflicts = [];
        
        if (coreDimensions.extraversion.score > 0.3 && coreDimensions.neuroticism.score > 0.3) {
            conflicts.push({
                type: '社交渴望与社交焦虑',
                description: '既渴望社交又害怕社交',
                manifestations: ['时而活跃时而退缩', '社交后需要独处恢复']
            });
        }
        
        return conflicts;
    }

    generateStressResponses(coreDimensions, complexities) {
        const responses = [];
        
        // 基于神经质水平生成压力反应
        if (coreDimensions.neuroticism.score > 0.5) {
            responses.push({
                type: '情绪化反应',
                description: '在压力下容易情绪波动',
                manifestations: ['焦虑', '易怒', '情绪低落']
            });
        } else if (coreDimensions.neuroticism.score < -0.5) {
            responses.push({
                type: '冷静应对',
                description: '在压力下保持冷静',
                manifestations: ['理性分析', '沉着应对', '情绪稳定']
            });
        }
        
        // 基于矛盾生成压力下的复杂反应
        complexities.contradictions.forEach(contradiction => {
            responses.push({
                type: '矛盾加剧',
                description: `压力下${contradiction.type}的矛盾加剧`,
                manifestations: contradiction.manifestations
            });
        });
        
        return responses;
    }

    generateRelationshipPatterns(coreDimensions, complexities) {
        return {
            attachmentStyle: this.generateAttachmentStyle(coreDimensions),
            communicationStyle: this.generateCommunicationStyle(coreDimensions),
            conflictResolution: this.generateConflictResolution(coreDimensions),
            intimacyPatterns: this.generateIntimacyPatterns(coreDimensions, complexities)
        };
    }

    generateAttachmentStyle(coreDimensions) {
        const anxiety = coreDimensions.neuroticism.score > 0.3;
        const avoidance = coreDimensions.extraversion.score < -0.3;
        
        if (anxiety && avoidance) {
            return '恐惧型依恋';
        } else if (anxiety) {
            return '焦虑型依恋';
        } else if (avoidance) {
            return '回避型依恋';
        } else {
            return '安全型依恋';
        }
    }

    generateCommunicationStyle(coreDimensions) {
        if (coreDimensions.extraversion.score > 0.3) {
            return '外向直接，善于表达';
        } else if (coreDimensions.extraversion.score < -0.3) {
            return '内向谨慎，思考后表达';
        } else {
            return '平衡的沟通方式';
        }
    }

    generateConflictResolution(coreDimensions) {
        if (coreDimensions.agreeableness.score > 0.3) {
            return '寻求合作共赢';
        } else if (coreDimensions.agreeableness.score < -0.3) {
            return '坚持己见，理性辩论';
        } else {
            return '根据情况灵活处理';
        }
    }

    generateIntimacyPatterns(coreDimensions, complexities) {
        const patterns = [];
        
        if (coreDimensions.neuroticism.score > 0.3) {
            patterns.push('在亲密关系中可能表现出焦虑和依赖');
        }
        
        if (complexities.contradictions.length > 0) {
            patterns.push('在亲密关系中可能表现出矛盾的行为');
        }
        
        return patterns;
    }

    generateGrowthPotential(coreDimensions, complexities) {
        const potential = {
            strengths: this.generateCharacterStrengths(coreDimensions),
            growthAreas: this.generateGrowthAreas(coreDimensions, complexities),
            possibleDevelopment: this.generatePossibleDevelopment(coreDimensions, complexities)
        };
        
        return potential;
    }

    generateCharacterStrengths(coreDimensions) {
        const strengths = [];
        
        Object.keys(coreDimensions).forEach(dimKey => {
            const dim = coreDimensions[dimKey];
            if (Math.abs(dim.score) > 0.5) {
                const strength = this.getDimensionStrength(dimKey, dim.score);
                if (strength) {
                    strengths.push(strength);
                }
            }
        });
        
        return strengths;
    }

    getDimensionStrength(dimension, score) {
        const strengths = {
            openness: score > 0 ? '创新思维' : '稳定可靠',
            conscientiousness: score > 0 ? '高效执行' : '灵活适应',
            extraversion: score > 0 ? '领导能力' : '深度思考',
            agreeableness: score > 0 ? '团队协作' : '独立判断',
            neuroticism: score < -0.5 ? '情绪稳定' : null
        };
        
        return strengths[dimension];
    }

    generateGrowthAreas(coreDimensions, complexities) {
        const areas = [];
        
        Object.keys(coreDimensions).forEach(dimKey => {
            const dim = coreDimensions[dimKey];
            if (Math.abs(dim.score) < 0.5) {
                areas.push({
                    dimension: dimKey,
                    currentLevel: dim.score,
                    potential: this.getDimensionPotential(dimKey, dim.score)
                });
            }
        });
        
        complexities.contradictions.forEach(contradiction => {
            areas.push({
                type: 'contradiction',
                description: contradiction.description,
                potential: '通过解决矛盾获得成长'
            });
        });
        
        return areas;
    }

    getDimensionPotential(dimension, score) {
        if (Math.abs(score) < 0.3) {
            return '有很大的成长空间';
        } else if (Math.abs(score) < 0.5) {
            return '有一定的成长空间';
        } else {
            return '成长空间有限';
        }
    }

    generatePossibleDevelopment(coreDimensions, complexities) {
        const developments = [];
        
        if (coreDimensions.neuroticism.score > 0.3) {
            developments.push('通过心理调适获得情绪稳定');
        }
        
        if (complexities.contradictions.length > 0) {
            developments.push('通过整合矛盾获得更完整的性格');
        }
        
        return developments;
    }

    formatCorePersonality(coreDimensions) {
        const descriptions = [];
        
        Object.keys(coreDimensions).forEach(dimKey => {
            const dim = coreDimensions[dimKey];
            descriptions.push(`${this.personalityDimensions[dimKey].name}：${dim.level}`);
        });
        
        return descriptions.join('，');
    }

    generatePersonalityDescription(complexPersonality) {
        let description = '';
        
        // 核心性格描述
        description += `**核心性格**：${complexPersonality.corePersonality}\n\n`;
        
        // 表面与深层性格
        description += `**表面表现**：${complexPersonality.surfaceTraits.join('、')}。`;
        description += `在社交场合通常表现出${complexPersonality.socialPresentation}。\n\n`;
        
        // 内心世界
        description += `**内心世界**：深层性格特征包括${complexPersonality.depthTraits.join('、')}。`;
        description += `内心真正渴望的是${complexPersonality.depthDesires.join('、')}，`;
        description += `但同时也担心${complexPersonality.depthFears.join('、')}。\n\n`;
        
        // 性格矛盾
        if (complexPersonality.contradictions.length > 0) {
            description += `**性格矛盾**：`;
            complexPersonality.contradictions.forEach(contradiction => {
                description += `${contradiction.description}，这种矛盾在${contradiction.triggers.join('或')}时特别明显。`;
            });
            description += `\n\n`;
        }
        
        // 行为模式
        description += `**行为模式**：`;
        complexPersonality.behavioralPatterns.forEach(pattern => {
            description += `${pattern.description}，特别是在${pattern.triggers.join('、')}时。`;
        });
        description += `\n\n`;
        
        // 压力反应
        description += `**压力反应**：在面对压力时，`;
        complexPersonality.stressResponses.forEach(response => {
            description += `${response.description}，表现为${response.manifestations.join('、')}。`;
        });
        description += `\n\n`;
        
        // 关系模式
        description += `**关系模式**：${complexPersonality.relationshipPatterns.attachmentStyle}，`;
        description += `在沟通中${complexPersonality.relationshipPatterns.communicationStyle}，`;
        description += `处理冲突时${complexPersonality.relationshipPatterns.conflictResolution}。\n\n`;
        
        // 成长潜力
        description += `**成长潜力**：性格优势包括${complexPersonality.growthPotential.strengths.join('、')}，`;
        description += `可能的成长方向是${complexPersonality.growthPotential.growthAreas.join('、')}。`;
        
        return description;
    }

    validateComplexPersonalityConsistency(character) {
        const { basicInfo, detailInfo } = character;
        const complexPersonality = detailInfo.complexPersonality;
        
        const validation = {
            consistent: true,
            issues: [],
            warnings: [],
            insights: [],
            complexityScore: 0
        };
        
        // 1. 验证性格维度的合理性
        const dimensionValidation = this.validatePersonalityDimensions(complexPersonality);
        validation.issues.push(...dimensionValidation.issues);
        validation.insights.push(...dimensionValidation.insights);
        
        // 2. 验证矛盾性格的合理性
        const contradictionValidation = this.validateContradictions(complexPersonality);
        validation.issues.push(...contradictionValidation.issues);
        validation.insights.push(...contradictionValidation.insights);
        
        // 3. 验证环境与性格的匹配度
        const environmentValidation = this.validateEnvironmentPersonalityMatch(basicInfo, complexPersonality);
        validation.issues.push(...environmentValidation.issues);
        validation.warnings.push(...environmentValidation.warnings);
        validation.insights.push(...environmentValidation.insights);
        
        // 4. 计算复杂度分数
        validation.complexityScore = this.calculateComplexityScore(complexPersonality);
        
        // 5. 生成改进建议
        validation.suggestions = this.generateComplexPersonalitySuggestions(validation);
        
        // 6. 判断整体一致性
        validation.consistent = validation.issues.length === 0;
        
        return validation;
    }

    validatePersonalityDimensions(complexPersonality) {
        const validation = { issues: [], insights: [] };
        
        const dimensions = complexPersonality.coreDimensions;
        
        // 检查维度的平衡性
        const extremeCount = Object.keys(dimensions).filter(dim => 
            Math.abs(dimensions[dim].score) > 0.8
        ).length;
        
        if (extremeCount > 3) {
            validation.issues.push({
                type: 'dimension_extremity',
                issue: '性格维度过于极端，可能缺乏平衡',
                suggestion: '考虑增加一些中间维度的特征，使性格更加平衡'
            });
        }
        
        // 检查维度的多样性
        const dimensionTypes = Object.keys(dimensions).map(dim => 
            dimensions[dim].score > 0 ? 'positive' : dimensions[dim].score < 0 ? 'negative' : 'neutral'
        );
        
        const positiveCount = dimensionTypes.filter(type => type === 'positive').length;
        const negativeCount = dimensionTypes.filter(type => type === 'negative').length;
        
        if (positiveCount === 0) {
            validation.warnings.push({
                type: 'all_negative',
                issue: '所有性格维度都是负向的，可能过于消极',
                suggestion: '考虑添加一些积极的性格特征'
            });
        }
        
        if (negativeCount === 0) {
            validation.insights.push({
                type: 'all_positive',
                insight: '所有性格维度都是正向的，这是一个积极向上的人物',
                note: '可以考虑添加一些小的缺点来增加真实感'
            });
        }
        
        return validation;
    }

    validateContradictions(complexPersonality) {
        const validation = { issues: [], insights: [] };
        
        const contradictions = complexPersonality.contradictions;
        
        // 检查矛盾的数量
        if (contradictions.length > 3) {
            validation.issues.push({
                type: 'too_many_contradictions',
                issue: '性格矛盾过多，可能显得人格分裂',
                suggestion: '减少到1-2个主要的矛盾，使其更加合理'
            });
        }
        
        // 检查矛盾的合理性
        contradictions.forEach(contradiction => {
            if (contradiction.intensity > 0.8) {
                validation.issues.push({
                    type: 'contradiction_too_intense',
                    issue: `矛盾"${contradiction.type}"过于强烈，可能导致人物不稳定`,
                    suggestion: '降低矛盾的强度或提供更好的解释'
                });
            }
        });
        
        if (contradictions.length === 0) {
            validation.insights.push({
                type: 'no_contradictions',
                insight: '人物没有明显的性格矛盾，性格相对一致',
                note: '可以考虑添加一些小的矛盾来增加深度'
            });
        }
        
        return validation;
    }

    validateEnvironmentPersonalityMatch(basicInfo, complexPersonality) {
        const validation = { issues: [], warnings: [], insights: [] };
        
        // 检查职业与性格的匹配
        const occupation = basicInfo.occupation;
        const coreDimensions = complexPersonality.coreDimensions;
        
        // 领导者通常需要较高的外向性和尽责性
        if (occupation.includes('领导') || occupation.includes('管理')) {
            if (coreDimensions.extraversion.score < 0.2) {
                validation.warnings.push({
                    type: 'leader_low_extraversion',
                    issue: '领导者的外向性较低，可能影响领导效果',
                    suggestion: '考虑增加外向性或提供其他领导特质的解释'
                });
            }
            
            if (coreDimensions.conscientiousness.score < 0.3) {
                validation.issues.push({
                    type: 'leader_low_conscientiousness',
                    issue: '领导者的尽责性较低，不适合领导角色',
                    suggestion: '增加尽责性或改变职业设定'
                });
            }
        }
        
        // 专业人士通常需要较高的尽责性和开放性
        if (occupation.includes('专业') || occupation.includes('专家')) {
            if (coreDimensions.conscientiousness.score < 0.3) {
                validation.issues.push({
                    type: 'professional_low_conscientiousness',
                    issue: '专业人士的尽责性较低，不符合专业要求',
                    suggestion: '增加尽责性或改变职业设定'
                });
            }
            
            if (coreDimensions.openness.score < 0.2) {
                validation.warnings.push({
                    type: 'professional_low_openness',
                    issue: '专业人士的开放性较低，可能限制专业发展',
                    suggestion: '考虑增加开放性或提供专业特质的解释'
                });
            }
        }
        
        // 检查背景与性格的匹配
        const background = basicInfo.background;
        
        if (background.includes('富裕家庭')) {
            if (coreDimensions.neuroticism.score > 0.6) {
                validation.insights.push({
                    type: 'wealthy_high_neuroticism',
                    insight: '富裕家庭出身但神经质较高，可能表明家庭压力或内在冲突',
                    note: '这是一个有趣的人物设定，可以深入探索'
                });
            }
        }
        
        if (background.includes('困难家庭')) {
            if (coreDimensions.neuroticism.score < -0.5) {
                validation.insights.push({
                    type: 'difficult_low_neuroticism',
                    insight: '困难家庭出身但情绪非常稳定，表明强大的心理韧性',
                    note: '这是一个值得深入探索的人物特质'
                });
            }
        }
        
        return validation;
    }

    calculateComplexityScore(complexPersonality) {
        let score = 0;
        
        // 基于性格维度计算
        const dimensions = complexPersonality.coreDimensions;
        Object.keys(dimensions).forEach(dim => {
            score += Math.abs(dimensions[dim].score);
        });
        
        // 基于矛盾计算
        score += complexPersonality.contradictions.length * 0.5;
        
        // 基于面具计算
        score += complexPersonality.masks.length * 0.3;
        
        // 基于行为模式计算
        score += complexPersonality.behavioralPatterns.length * 0.2;
        
        return Math.min(10, score);
    }

    generateComplexPersonalitySuggestions(validation) {
        const suggestions = [];
        
        // 基于问题生成建议
        validation.issues.forEach(issue => {
            suggestions.push({
                type: 'fix_issue',
                priority: 'high',
                description: issue.suggestion || `解决: ${issue.issue}`
            });
        });
        
        // 基于警告生成建议
        validation.warnings.forEach(warning => {
            suggestions.push({
                type: 'address_warning',
                priority: 'medium',
                description: warning.suggestion || `考虑: ${warning.issue}`
            });
        });
        
        // 基于洞察生成建议
        validation.insights.forEach(insight => {
            suggestions.push({
                type: 'explore_insight',
                priority: 'low',
                description: insight.note || `探索: ${insight.insight}`
            });
        });
        
        // 基于复杂度分数生成建议
        if (validation.complexityScore < 3) {
            suggestions.push({
                type: 'increase_complexity',
                priority: 'medium',
                description: '考虑增加一些性格矛盾或深层特质，使人物更加复杂'
            });
        } else if (validation.complexityScore > 8) {
            suggestions.push({
                type: 'simplify_complexity',
                priority: 'medium',
                description: '人物过于复杂，考虑简化一些矛盾或特质，使其更加可信'
            });
        }
        
        return suggestions;
    }

    getDimensionInfluences(dimension, environmentalAnalysis) {
        // 简化实现，返回影响来源
        return environmentalAnalysis.interactions
            .filter(interaction => this.getPressureEffects(dimension, interaction) !== 0)
            .map(interaction => interaction.source);
    }

    getAdvantageEffects(dimension, advantage) {
        // 简化实现，返回优势对维度的影响
        const effects = {
            openness: {
                '资源丰富': 0.2,
                '视野开阔': 0.3,
                '教育优质': 0.25
            },
            conscientiousness: {
                '资源丰富': 0.1,
                '教育优质': 0.2,
                '社会网络': 0.15
            },
            extraversion: {
                '社会网络': 0.3,
                '资源丰富': 0.1
            },
            agreeableness: {
                '教育优质': 0.1,
                '资源丰富': -0.1  // 可能导致傲慢
            },
            neuroticism: {
                '资源丰富': -0.2,  // 减少焦虑
                '教育优质': -0.1
            }
        };
        
        return effects[dimension][advantage.source] || 0;
    }

    getChallengeEffects(dimension, challenge) {
        // 简化实现，返回挑战对维度的影响
        const effects = {
            openness: {
                '资源匮乏': -0.2,
                '视野局限': -0.3,
                '环境限制': -0.25
            },
            conscientiousness: {
                '资源匮乏': 0.2,  // 增加尽责性以应对挑战
                '环境限制': 0.15
            },
            extraversion: {
                '资源匮乏': -0.1,
                '环境恶劣': -0.2
            },
            agreeableness: {
                '环境恶劣': -0.2,  // 可能导致不信任
                '价值观偏差': -0.3
            },
            neuroticism: {
                '资源匮乏': 0.3,   // 增加焦虑
                '环境恶劣': 0.4,
                '心理创伤': 0.5
            }
        };
        
        return effects[dimension][challenge.source] || 0;
    }
}

// 主插件类 - 分层人物世界书系统
class LayeredCharacterSystem {
    constructor() {
        this.name = 'Layered Character Worldbook System';
        this.version = '2.0.0';
        
        // 系统状态
        this.characters = new Map(); // 所有人物数据
        this.characterIndex = []; // 人物索引
        this.activeEntries = new Set(); // 当前激活的世界书条目
        this.interactionHistory = new Map(); // 交互历史
        
        // 配置设置
        this.settings = {
            enabled: true,
            autoGenerate: true,
            maxMainCharacters: 5,
            maxSecondaryCharacters: 15,
            maxBackgroundCharacters: 30,
            tokenBudget: 2000,
            triggerCooldown: 5 * 60 * 1000, // 5分钟冷却
            autoUpgrade: true,
            cleanupInterval: 30 * 60 * 1000, // 30分钟清理
            enableGrowthSystem: true // 启用成长系统
        };
        
        // 人物重要性定义
        this.importanceLevels = {
            main: {
                name: '主要人物',
                tokenBudget: 800,
                detailLevel: 'high',
                priority: 3,
                upgradeThreshold: 25
            },
            secondary: {
                name: '次要人物',
                tokenBudget: 300,
                detailLevel: 'medium',
                priority: 2,
                upgradeThreshold: 10
            },
            background: {
                name: '背景人物',
                tokenBudget: 100,
                detailLevel: 'low',
                priority: 1,
                upgradeThreshold: 0
            }
        };
        
        // 人物生成模板
        this.characterTemplates = {
            names: {
                male: ["李明", "张强", "王磊", "刘伟", "陈杰", "杨帆", "赵勇", "黄涛", "周林", "吴超"],
                female: ["王芳", "李娜", "张丽", "刘敏", "陈静", "杨雪", "赵莉", "黄梅", "周燕", "吴红"],
                surname: ["欧阳", "司马", "上官", "独孤", "南宫", "东方", "西门", "北冥", "南华", "东篱"]
            },
            personalities: {
                main: [
                    "开朗活泼、正直勇敢、重情重义", "内向害羞、聪明睿智、观察敏锐",
                    "冷酷无情、行事果断、目标明确", "温柔善良、富有同情心、乐于助人",
                    "狡猾机智、善于交际、追求利益", "严肃认真、责任心强、一丝不苟"
                ],
                secondary: [
                    "开朗活泼", "内向害羞", "冷酷无情", "温柔善良", "狡猾机智",
                    "正直勇敢", "懦弱胆小", "幽默风趣", "严肃认真", "随和友善"
                ],
                background: [
                    "普通", "友善", "忙碌", "沉默", "热情", "警惕", "好奇", "疲惫"
                ]
            },
            occupations: {
                main: ["铁匠", "药师", "商会会长", "守卫队长", "魔法师"],
                secondary: ["商人", "士兵", "学者", "医生", "盗贼", "工匠", "艺术家"],
                background: ["村民", "市民", "路人", "学徒", "伙计", "仆人"]
            },
            backgrounds: {
                main: [
                    "出身名门望族，家族显赫",
                    "孤儿院长大，自学成才",
                    "世家传承，技艺精湛",
                    "游历四方，见多识广",
                    "隐居山林，神秘莫测"
                ],
                secondary: [
                    "出身普通家庭，努力奋斗",
                    "从小拜师学艺，技艺纯熟",
                    "经商致富，家道殷实",
                    "从军归来，经验丰富",
                    "求学多年，知识渊博"
                ],
                background: [
                    "本地居民", "外来移民", "打工谋生", "退休养老", "临时停留"
                ]
            }
        };
        
        // 触发关键词
        this.triggerKeywords = {
            generate: ['遇到', '看见', '发现', '认识', '碰到', '陌生人', '路人', '居民', '村民', '市民'],
            index: ['人物索引', '角色列表', '所有人物', '人物总览', '有哪些人', '人物统计'],
            location: ['酒馆', '市场', '铁匠铺', '药店', '城门', '旅店', '商店', '街道']
        };
        
        // 初始化组件
        this.worldBookManager = new WorldBookManager(this);
        this.triggerSystem = new SmartTriggerSystem(this);
        this.importanceManager = new CharacterImportanceManager(this);
        this.worldSettingDetector = new WorldSettingDetector();
        this.complexPersonalityEngine = new ComplexPersonalityEngine();
        this.growthSystem = new CharacterGrowthSystem();
        this.uiManager = new UIManager(this);
        
        // 设置反向引用
        this.growthSystem.plugin = this;
        this.complexPersonalityEngine.plugin = this;
        this.worldSettingDetector.plugin = this;
    }

    // 插件初始化
    async init() {
        console.log(`${this.name} v${this.version} 插件已加载`);
        
        // 加载设置
        this.loadSettings();
        
        // 初始化世界书
        await this.initializeWorldBook();
        
        // 初始化成长系统
        if (this.settings.enableGrowthSystem) {
            this.initializeGrowthSystem();
        }
        
        // 注册事件监听器
        this.registerEventListeners();
        
        // 创建用户界面
        this.uiManager.createUI();
        
        // 启动定时任务
        this.startPeriodicTasks();
        
        console.log('分层人物世界书系统初始化完成');
    }

    // 加载设置
    loadSettings() {
        const saved = localStorage.getItem('layeredCharacterSystemSettings');
        if (saved) {
            try {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
            } catch (error) {
                console.error('加载设置失败:', error);
            }
        }
    }

    // 保存设置
    saveSettings() {
        try {
            localStorage.setItem('layeredCharacterSystemSettings', JSON.stringify(this.settings));
        } catch (error) {
            console.error('保存设置失败:', error);
        }
    }

    // 初始化世界书
    async initializeWorldBook() {
        try {
            // 创建蓝灯索引条目
            await this.worldBookManager.createIndexEntry();
            
            // 加载现有人物
            await this.loadExistingCharacters();
            
            console.log('世界书初始化完成');
        } catch (error) {
            console.error('世界书初始化失败:', error);
        }
    }

    // 加载现有人物
    async loadExistingCharacters() {
        try {
            const worldBook = await this.worldBookManager.getCurrentWorldBook();
            
            // 查找人物相关条目
            worldBook.entries.forEach(entry => {
                if (entry.id && entry.id.startsWith('CHAR_')) {
                    const character = this.parseCharacterFromEntry(entry);
                    if (character) {
                        this.characters.set(character.id, character);
                        this.updateCharacterIndex(character);
                        
                        // 初始化成长数据
                        if (this.settings.enableGrowthSystem && !character.growthData) {
                            character.growthData = this.growthSystem.initializeCharacterGrowth(character);
                        }
                    }
                }
            });
            
            // 更新索引条目
            await this.updateIndexEntry();
            
            console.log(`加载了 ${this.characters.size} 个现有人物`);
        } catch (error) {
            console.error('加载现有人物失败:', error);
        }
    }

    // 从条目解析人物
    parseCharacterFromEntry(entry) {
        try {
            const lines = entry.content.split('\n');
            const character = {
                id: entry.id,
                name: '',
                importance: 'background',
                basicInfo: {},
                detailInfo: {},
                keys: entry.keys || [],
                lastUpdated: new Date().toISOString()
            };
            
            // 解析基本信息
            lines.forEach(line => {
                if (line.includes('姓名：')) {
                    character.name = line.split('姓名：')[1]?.trim();
                } else if (line.includes('重要性：')) {
                    const importance = line.split('重要性：')[1]?.trim();
                    if (importance.includes('主要')) character.importance = 'main';
                    else if (importance.includes('次要')) character.importance = 'secondary';
                }
            });
            
            if (character.name) {
                return character;
            }
        } catch (error) {
            console.error('解析人物条目失败:', error);
        }
        
        return null;
    }

    // 初始化成长系统
    initializeGrowthSystem() {
        // 为现有人物初始化成长数据
        this.characters.forEach((character, characterId) => {
            if (!character.growthData) {
                character.growthData = this.growthSystem.initializeCharacterGrowth(character);
            }
        });
        
        // 监听成长相关事件
        this.setupGrowthEventListeners();
        
        console.log('成长系统初始化完成');
    }

    // 设置成长事件监听器
    setupGrowthEventListeners() {
        // 监听人物成长事件
        $(document).on('character_grew', (e, characterId, growthResult) => {
            console.log(`人物成长事件：${characterId}`, growthResult);
            this.uiManager.updateCharacterGrowthUI(characterId);
        });
        
        // 监听里程碑达成事件
        $(document).on('character_milestones_achieved', (e, characterId, milestones) => {
            console.log(`人物里程碑达成：${characterId}`, milestones);
            this.uiManager.showMilestoneNotification(characterId, milestones);
        });
        
        // 监听成长数据保存事件
        $(document).on('character_growth_saved', (e, characterId, growthData) => {
            console.log(`成长数据已保存：${characterId}`);
        });
    }

    // 注册事件监听器
    registerEventListeners() {
        // 监听消息发送
        $(document).on('message_send', (e, data) => {
            if (this.settings.enabled) {
                this.handleMessageSend(data);
            }
        });
        
        // 监听消息接收
        $(document).on('message_received', (e, data) => {
            if (this.settings.enabled) {
                this.handleMessageReceived(data);
            }
        });
        
        // 监听世界书更新
        $(document).on('worldbook_updated', (e, data) => {
            this.handleWorldBookUpdate(data);
        });
    }

    // 处理消息发送
    async handleMessageSend(data) {
        const message = data.message;
        
        // 检查是否需要生成新人物
        if (this.settings.autoGenerate && this.shouldGenerateCharacter(message)) {
            await this.handleCharacterGeneration(message, data);
        }
        
        // 检查是否需要查询人物索引
        if (this.shouldShowIndex(message)) {
            await this.handleIndexQuery(message);
        }
        
        // 检测成长事件
        if (this.settings.enableGrowthSystem) {
            await this.detectAndProcessGrowthEvents(message, data);
        }
        
        // 更新交互历史
        this.updateInteractionHistory(message);
    }

    // 处理消息接收
    handleMessageReceived(data) {
        // AI回复中可能包含人物信息，需要处理
        this.processAIMessage(data.message);
    }

    // 处理世界书更新
    handleWorldBookUpdate(data) {
        console.log('世界书已更新:', data);
    }

    // 判断是否需要生成人物
    shouldGenerateCharacter(message) {
        return this.triggerKeywords.generate.some(keyword => 
            message.toLowerCase().includes(keyword.toLowerCase())
        );
    }

    // 判断是否需要显示索引
    shouldShowIndex(message) {
        return this.triggerKeywords.index.some(keyword => 
            message.toLowerCase().includes(keyword.toLowerCase())
        );
    }

    // 处理人物生成
    async handleCharacterGeneration(message, context) {
        try {
            // 检查人物数量限制
            if (this.isCharacterLimitReached()) {
                this.showNotification('已达到人物数量限制', 'warning');
                return;
            }
            
            // 生成新人物
            const character = await this.generateCharacter(message, context);
            
            if (character) {
                // 添加到系统
                this.characters.set(character.id, character);
                this.updateCharacterIndex(character);
                
                // 创建世界书条目
                await this.worldBookManager.createCharacterEntry(character);
                
                // 更新索引条目
                await this.updateIndexEntry();
                
                // 显示通知
                this.showNotification(`生成新人物：${character.name}`, 'success');
                
                // 记录生成事件
                this.logEvent('character_generated', { characterId: character.id, name: character.name });
            }
        } catch (error) {
            console.error('人物生成失败:', error);
            this.showNotification('人物生成失败', 'error');
        }
    }

    // 生成人物
    async generateCharacter(message, context) {
        console.log('开始生成人物...');
        
        // 1. 检测世界设定
        const worldSetting = this.worldSettingDetector.detectWorldSetting(context);
        console.log('世界设定检测结果:', worldSetting);
        
        // 2. 确定人物重要性
        const importance = this.determineCharacterImportance(message, context);
        
        // 3. 生成人物ID
        const characterId = this.generateCharacterId();
        
        // 4. 生成符合世界设定的基本信息
        const basicInfo = this.generateWorldAwareBasicInfo(importance, context, worldSetting);
        
        // 5. 生成详细信息
        const detailInfo = await this.generateLogicalDetailInfo(importance, basicInfo, worldSetting);
        
        // 6. 创建人物对象
        const character = {
            id: characterId,
            name: basicInfo.name,
            importance: importance,
            basicInfo: basicInfo,
            detailInfo: detailInfo,
            keys: [basicInfo.name, basicInfo.occupation],
            worldSetting: worldSetting.setting,
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            interactionCount: 0,
            plotRelevance: 0,
            playerRelationship: 0,
            personalityValidation: null
        };
        
        // 7. 验证人物一致性
        const validation = this.complexPersonalityEngine.validateComplexPersonalityConsistency(character);
        character.personalityValidation = validation;
        
        // 8. 初始化成长数据
        if (this.settings.enableGrowthSystem) {
            character.growthData = this.growthSystem.initializeCharacterGrowth(character);
        }
        
        console.log('人物生成完成:', character.name);
        console.log('性格验证结果:', validation);
        
        return character;
    }

    // 确定人物重要性
    determineCharacterImportance(message, context) {
        let score = 0;
        
        // 基于消息内容评分
        if (message.includes('重要') || message.includes('关键')) score += 3;
        if (message.includes('导师') || message.includes('首领')) score += 2;
        if (message.includes('朋友') || message.includes('盟友')) score += 1;
        
        // 基于位置评分
        const locationKeywords = ['铁匠铺', '药店', '商会', '守卫塔'];
        if (locationKeywords.some(keyword => message.includes(keyword))) {
            score += 2;
        }
        
        // 基于当前人物数量评分
        const mainCount = this.getCharacterCountByImportance('main');
        const secondaryCount = this.getCharacterCountByImportance('secondary');
        
        if (mainCount < this.settings.maxMainCharacters && score >= 3) {
            return 'main';
        } else if (secondaryCount < this.settings.maxSecondaryCharacters && score >= 1) {
            return 'secondary';
        } else {
            return 'background';
        }
    }

    // 生成人物ID
    generateCharacterId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return `CHAR_${timestamp}_${random}`.toUpperCase();
    }

    // 生成符合世界设定的基本信息
    generateWorldAwareBasicInfo(importance, context, worldSetting) {
        const gender = Math.random() < 0.5 ? 'male' : 'female';
        const useSurname = Math.random() < 0.3;
        
        let name;
        if (useSurname) {
            const surname = this.getRandomItem(this.characterTemplates.names.surname);
            const givenName = this.getRandomItem(this.characterTemplates.names[gender]);
            name = surname + givenName;
        } else {
            name = this.getRandomItem(this.characterTemplates.names[gender]);
        }
        
        // 根据世界设定选择职业
        const allowedOccupations = worldSetting.details.allowedOccupations;
        const occupationTemplates = this.characterTemplates.occupations[importance].filter(occ => 
            allowedOccupations.some(allowed => occ.includes(allowed) || allowed.includes(occ))
        );
        
        const occupation = occupationTemplates.length > 0 ? 
            this.getRandomItem(occupationTemplates) : 
            this.getRandomItem(allowedOccupations);
        
        // 根据世界设定选择背景
        const allowedBackgrounds = worldSetting.details.allowedBackgrounds;
        const backgroundTemplates = this.characterTemplates.backgrounds[importance].filter(bg => 
            allowedBackgrounds.some(allowed => bg.includes(allowed) || allowed.includes(bg))
        );
        
        const background = backgroundTemplates.length > 0 ? 
            this.getRandomItem(backgroundTemplates) : 
            this.getRandomItem(allowedBackgrounds);
        
        return {
            name: name,
            gender: gender === 'male' ? '男' : '女',
            age: Math.floor(Math.random() * (80 - 16 + 1)) + 16,
            occupation: occupation,
            location: this.extractLocation(context.message) || '未知地点',
            worldSetting: worldSetting.setting
        };
    }

    // 生成具有逻辑一致性的详细信息
    async generateLogicalDetailInfo(importance, basicInfo, worldSetting) {
        // 1. 生成基础详细信息
        const baseDetailInfo = this.generateDetailInfo(importance, basicInfo);
        
        // 2. 应用复杂性格引擎
        const tempCharacter = {
            basicInfo: basicInfo,
            detailInfo: baseDetailInfo
        };
        
        const complexPersonality = this.complexPersonalityEngine.generateComplexCharacter(tempCharacter);
        
        // 3. 更新性格信息
        baseDetailInfo.personality = complexPersonality.corePersonality;
        baseDetailInfo.complexPersonality = complexPersonality;
        
        // 4. 生成性格描述
        baseDetailInfo.personalityDescription = this.complexPersonalityEngine.generatePersonalityDescription(complexPersonality);
        
        // 5. 根据世界设定调整其他信息
        this.adjustDetailInfoForWorldSetting(baseDetailInfo, worldSetting);
        
        // 6. 确保所有信息的一致性
        this.ensureConsistency(baseDetailInfo, basicInfo, worldSetting);
        
        return baseDetailInfo;
    }

    // 生成基础详细信息
    generateDetailInfo(importance, basicInfo) {
        const templates = {
            main: {
                personality: this.getRandomItem(this.characterTemplates.personalities.main),
                background: this.getRandomItem(this.characterTemplates.backgrounds.main),
                appearance: this.generateDetailedAppearance(),
                skills: this.generateDetailedSkills(),
                relationships: this.generateDetailedRelationships(),
                story: this.generateDetailedStory()
            },
            secondary: {
                personality: this.getRandomItem(this.characterTemplates.personalities.secondary),
                background: this.getRandomItem(this.characterTemplates.backgrounds.secondary),
                appearance: this.generateMediumAppearance(),
                skills: this.generateMediumSkills(),
                relationships: this.generateMediumRelationships()
            },
            background: {
                personality: this.getRandomItem(this.characterTemplates.personalities.background),
                background: this.getRandomItem(this.characterTemplates.backgrounds.background),
                appearance: this.generateSimpleAppearance(),
                skills: this.generateSimpleSkills()
            }
        };
        
        return templates[importance];
    }

    // 生成详细外貌
    generateDetailedAppearance() {
        const features = [
            "身材高大魁梧", "中等身材", "身材瘦削", "体型丰满",
            "面容俊美", "相貌平平", "饱经风霜", "年轻有活力"
        ];
        
        const styles = [
            "留着长发", "短发利落", "光头", "扎着辫子",
            "有胡须", "面容干净", "有疤痕", "有纹身"
        ];
        
        const clothing = [
            "穿着华丽的服装", "衣着朴素", "穿着工作服", "穿着盔甲",
            "穿着长袍", "穿着便装", "穿着制服", "穿着奇装异服"
        ];
        
        return `${this.getRandomItem(features)}，${this.getRandomItem(styles)}，${this.getRandomItem(clothing)}`;
    }

    // 生成中等外貌
    generateMediumAppearance() {
        const appearances = [
            "高个子", "矮个子", "身材魁梧", "身材瘦削",
            "面容俊美", "相貌平平", "留着长发", "短发利落"
        ];
        
        return this.getRandomItems(appearances, 2, 3).join('、');
    }

    // 生成简单外貌
    generateSimpleAppearance() {
        const simple = ["普通", "友善", "忙碌", "沉默"];
        return this.getRandomItem(simple);
    }

    // 生成详细技能
    generateDetailedSkills() {
        const skills = [
            "武器锻造：精通", "盔甲制作：熟练", "金属鉴定：专家",
            "商业谈判：精通", "商品鉴定：熟练", "市场信息：丰富",
            "医疗技术：精通", "草药学：熟练", "诊断：专家"
        ];
        
        return this.getRandomItems(skills, 3, 5).join('，');
    }

    // 生成中等技能
    generateMediumSkills() {
        const skills = [
            "专业技能", "社交能力", "战斗技巧", "知识水平", "手工艺"
        ];
        
        return `${this.getRandomItem(skills)}：熟练`;
    }

    // 生成简单技能
    generateSimpleSkills() {
        const skills = ["基础技能", "普通能力", "日常工作"];
        return this.getRandomItem(skills);
    }

    // 生成详细关系
    generateDetailedRelationships() {
        const relationships = [
            "与王铁匠：商业伙伴，互相信任",
            "与李商人：竞争对手，关系紧张",
            "与赵药师：好友，经常合作",
            "与张守卫：上下级，相互尊重"
        ];
        
        return this.getRandomItems(relationships, 2, 4).join('；');
    }

    // 生成中等关系
    generateMediumRelationships() {
        const relationships = ["友好", "中立", "警惕", "竞争"];
        return this.getRandomItem(relationships);
    }

    // 生成详细背景故事
    generateDetailedStory() {
        const stories = [
            "出身名门望族，家族显赫，从小接受良好教育",
            "孤儿院长大，自学成才，凭借努力获得今天的成就",
            "世家传承，技艺精湛，是家族中的佼佼者",
            "游历四方，见多识广，拥有丰富的阅历和经验",
            "隐居山林，神秘莫测，很少有人知道其真实身份"
        ];
        
        return this.getRandomItem(stories);
    }

    // 根据世界设定调整详细信息
    adjustDetailInfoForWorldSetting(detailInfo, worldSetting) {
        const setting = worldSetting.details;
        
        // 根据技术水平调整技能
        if (setting.technologyLevel === 'modern') {
            detailInfo.skills = this.adjustSkillsForModernWorld(detailInfo.skills);
        } else if (setting.technologyLevel === 'pre-industrial') {
            detailInfo.skills = this.adjustSkillsForFantasyWorld(detailInfo.skills);
        } else if (setting.technologyLevel === 'advanced') {
            detailInfo.skills = this.adjustSkillsForSciFiWorld(detailInfo.skills);
        }
        
        // 根据社会结构调整关系
        if (setting.socialStructure === 'contemporary') {
            detailInfo.relationships = this.adjustRelationshipsForModernWorld(detailInfo.relationships);
        } else if (setting.socialStructure === 'feudal') {
            detailInfo.relationships = this.adjustRelationshipsForFantasyWorld(detailInfo.relationships);
        }
    }

    // 调整现代世界技能
    adjustSkillsForModernWorld(skills) {
        const modernSkills = {
            '武器锻造': '机械维修',
            '草药学': '医学知识',
            '商业谈判': '商业管理',
            '魔法': '科技知识',
            '剑术': '格斗技巧'
        };
        
        let adjustedSkills = skills;
        Object.keys(modernSkills).forEach(oldSkill => {
            adjustedSkills = adjustedSkills.replace(new RegExp(oldSkill, 'g'), modernSkills[oldSkill]);
        });
        
        return adjustedSkills;
    }

    // 调整奇幻世界技能
    adjustSkillsForFantasyWorld(skills) {
        const fantasySkills = {
            '机械维修': '武器锻造',
            '医学知识': '草药学',
            '商业管理': '商业谈判',
            '科技知识': '魔法',
            '格斗技巧': '剑术'
        };
        
        let adjustedSkills = skills;
        Object.keys(fantasySkills).forEach(oldSkill => {
            adjustedSkills = adjustedSkills.replace(new RegExp(oldSkill, 'g'), fantasySkills[oldSkill]);
        });
        
        return adjustedSkills;
    }

    // 调整科幻世界技能
    adjustSkillsForSciFiWorld(skills) {
        const scifiSkills = {
            '武器锻造': '能量武器制造',
            '草药学': '生物医学',
            '商业谈判': '星际贸易',
            '魔法': '超能力',
            '剑术': '能量剑技巧'
        };
        
        let adjustedSkills = skills;
        Object.keys(scifiSkills).forEach(oldSkill => {
            adjustedSkills = adjustedSkills.replace(new RegExp(oldSkill, 'g'), scifiSkills[oldSkill]);
        });
        
        return adjustedSkills;
    }

    // 调整现代世界关系
    adjustRelationshipsForModernWorld(relationships) {
        return relationships.replace(/商会/g, '公司')
                      .replace(/领主/g, '总裁')
                      .replace(/骑士/g, '保镖')
                      .replace(/国王/g, '总统');
    }

    // 调整奇幻世界关系
    adjustRelationshipsForFantasyWorld(relationships) {
        return relationships.replace(/公司/g, '商会')
                      .replace(/总裁/g, '领主')
                      .replace(/保镖/g, '骑士')
                      .replace(/总统/g, '国王');
    }

    // 确保信息一致性
    ensureConsistency(detailInfo, basicInfo, worldSetting) {
        // 1. 验证世界设定一致性
        const validation = this.worldSettingDetector.validateCharacterForWorld(
            { basicInfo, detailInfo }, 
            worldSetting.details
        );
        
        if (!validation.valid) {
            console.warn('人物世界设定验证失败:', validation.issues);
        }
        
        // 2. 确保年龄与经历匹配
        this.ensureAgeExperienceConsistency(detailInfo, basicInfo);
        
        // 3. 确保职业与技能匹配
        this.ensureOccupationSkillConsistency(detailInfo, basicInfo);
    }

    // 确保年龄与经历一致性
    ensureAgeExperienceConsistency(detailInfo, basicInfo) {
        const age = basicInfo.age;
        const story = detailInfo.story || '';
        
        // 年轻人物不应该有过于丰富的经历
        if (age <= 25 && story.includes('多年')) {
            detailInfo.story = story.replace('多年', '几年');
        }
        
        // 年长人物应该有相应的经历描述
        if (age >= 50 && !story.includes('丰富') && !story.includes('多年')) {
            detailInfo.story += '，拥有丰富的人生阅历';
        }
    }

    // 确保职业与技能一致性
    ensureOccupationSkillConsistency(detailInfo, basicInfo) {
        const occupation = basicInfo.occupation;
        const skills = detailInfo.skills;
        
        // 为不同职业添加核心技能
        const coreSkills = {
            '医生': '医学知识',
            '铁匠': '武器锻造',
            '商人': '商业谈判',
            '法师': '魔法',
            '科学家': '科学研究'
        };
        
        Object.keys(coreSkills).forEach(occ => {
            if (occupation.includes(occ) && !skills.includes(coreSkills[occ])) {
                detailInfo.skills += `，${coreSkills[occ]}：精通`;
            }
        });
    }

    // 更新人物索引
    updateCharacterIndex(character) {
        const indexEntry = {
            id: character.id,
            name: character.name,
            occupation: character.basicInfo.occupation,
            importance: character.importance,
            status: 'active',
            lastSeen: character.basicInfo.location,
            lastUpdated: character.lastUpdated
        };
        
        // 更新或添加索引
        const existingIndex = this.characterIndex.findIndex(item => item.id === character.id);
        if (existingIndex >= 0) {
            this.characterIndex[existingIndex] = indexEntry;
        } else {
            this.characterIndex.push(indexEntry);
        }
    }

    // 更新索引条目
    async updateIndexEntry() {
        try {
            const indexContent = this.generateIndexContent();
            await this.worldBookManager.updateIndexEntry(indexContent);
        } catch (error) {
            console.error('更新索引条目失败:', error);
        }
    }

    // 生成索引内容
    generateIndexContent() {
        const importanceEmoji = {
            main: '🌟',
            secondary: '⭐',
            background: '💫'
        };
        
        let content = `【世界人物索引】
📋 **人物总览表**
格式：[ID] 姓名 | 职业 | 重要性 | 关系状态 | 最近出现
👥 **已登记人物**：
`;
        
        this.characterIndex.forEach(character => {
            content += `[${character.id}] ${character.name} | ${character.occupation} | ${importanceEmoji[character.importance]}${this.importanceLevels[character.importance].name} | ${character.status} | ${character.lastSeen}\n`;
        });
        
        const stats = this.getCharacterStats();
        content += `
📊 **统计信息**：
- 总人数：${stats.total}人
- 主要人物：${stats.main}人
- 次要人物：${stats.secondary}人
- 背景人物：${stats.background}人
- 最近更新：${new Date().toLocaleString()}
⚡ **使用说明**：
当对话中提到具体人物姓名时，系统会自动加载该人物的详细信息。
本索引表保持轻量化，确保高效的token使用。`;
        
        return content;
    }

    // 获取人物统计
    getCharacterStats() {
        const stats = {
            total: this.characters.size,
            main: 0,
            secondary: 0,
            background: 0
        };
        
        this.characters.forEach(character => {
            stats[character.importance]++;
        });
        
        return stats;
    }

    // 按重要性获取人物数量
    getCharacterCountByImportance(importance) {
        let count = 0;
        this.characters.forEach(character => {
            if (character.importance === importance) {
                count++;
            }
        });
        return count;
    }

    // 检查人物数量限制
    isCharacterLimitReached() {
        const stats = this.getCharacterStats();
        return stats.total >= (this.settings.maxMainCharacters + 
                              this.settings.maxSecondaryCharacters + 
                              this.settings.maxBackgroundCharacters);
    }

    // 处理索引查询
    async handleIndexQuery(message) {
        try {
            const indexContent = this.generateIndexContent();
            
            // 在AI回复中插入索引信息
            this.insertIndexToResponse(indexContent);
            
            this.logEvent('index_queried', { message });
        } catch (error) {
            console.error('处理索引查询失败:', error);
        }
    }

    // 插入索引到回复
    insertIndexToResponse(indexContent) {
        // 这里需要根据SillyTavern的API来实现
        // 暂时记录到控制台
        console.log('插入索引信息到回复:', indexContent);
    }

    // 检测和处理成长事件
    async detectAndProcessGrowthEvents(message, context) {
        // 分析消息是否包含成长事件
        const growthEvents = this.extractGrowthEvents(message);
        
        for (const event of growthEvents) {
            // 为每个相关人物处理成长事件
            for (const [characterId, character] of this.characters) {
                if (this.isEventRelevantToCharacter(event, character)) {
                    const result = await this.growthSystem.processGrowthEvent(character, event);
                    
                    if (result.growthOccurred) {
                        // 处理成长结果
                        await this.handleCharacterGrowth(character, result);
                        
                        // 显示成长通知
                        this.showGrowthNotification(character, result);
                    }
                }
            }
        }
    }

    // 提取成长事件
    extractGrowthEvents(message) {
        const events = [];
        
        // 成功事件
        if (message.includes('成功') || message.includes('完成') || message.includes('达成')) {
            events.push({
                type: 'success',
                description: message,
                intensity: this.extractEventIntensity(message)
            });
        }
        
        // 失败事件
        if (message.includes('失败') || message.includes('挫折') || message.includes('错误')) {
            events.push({
                type: 'failure',
                description: message,
                intensity: this.extractEventIntensity(message)
            });
        }
        
        // 关系事件
        if (message.includes('朋友') || message.includes('恋人') || message.includes('信任')) {
            events.push({
                type: 'relationship',
                description: message,
                intensity: this.extractEventIntensity(message)
            });
        }
        
        // 挑战事件
        if (message.includes('挑战') || message.includes('困难') || message.includes('克服')) {
            events.push({
                type: 'challenge',
                description: message,
                intensity: this.extractEventIntensity(message)
            });
        }
        
        // 学习事件
        if (message.includes('学习') || message.includes('掌握') || message.includes('理解')) {
            events.push({
                type: 'learning',
                description: message,
                intensity: this.extractEventIntensity(message)
            });
        }
        
        // 冲突事件
        if (message.includes('冲突') || message.includes('争论') || message.includes('战斗')) {
            events.push({
                type: 'conflict',
                description: message,
                intensity: this.extractEventIntensity(message)
            });
        }
        
        return events;
    }

    // 提取事件强度
    extractEventIntensity(message) {
        const intensityKeywords = {
            high: ['非常', '极其', '巨大', '重大', '深刻', '彻底'],
            medium: ['很', '挺', '相当', '比较', '较为'],
            low: ['有点', '稍微', '略微', '一些']
        };
        
        let intensity = 0.5; // 默认中等强度
        
        Object.keys(intensityKeywords).forEach(level => {
            const keywords = intensityKeywords[level];
            if (keywords.some(keyword => message.includes(keyword))) {
                switch(level) {
                    case 'high': intensity = 1.0; break;
                    case 'medium': intensity = 0.5; break;
                    case 'low': intensity = 0.2; break;
                }
            }
        });
        
        return intensity;
    }

    // 判断事件是否与人物相关
    isEventRelevantToCharacter(event, character) {
        // 检查事件是否提及人物姓名
        if (event.description.includes(character.name)) {
            return true;
        }
        
        // 检查事件是否提及人物职业
        if (event.description.includes(character.basicInfo.occupation)) {
            return true;
        }
        
        // 检查事件是否提及人物位置
        if (event.description.includes(character.basicInfo.location)) {
            return true;
        }
        
        // 检查是否是当前活跃的人物
        if (this.activeEntries.has(character.id)) {
            return true;
        }
        
        return false;
    }

    // 处理人物成长
    async handleCharacterGrowth(character, growthResult) {
        // 更新人物数据
        character.lastUpdated = new Date().toISOString();
        
        // 更新世界书条目
        await this.worldBookManager.createCharacterEntry(character);
        
        // 更新索引
        this.updateCharacterIndex(character);
        await this.updateIndexEntry();
        
        // 记录成长事件
        this.logEvent('character_growth', {
            characterId: character.id,
            name: character.name,
            changes: growthResult.changes,
            growthType: growthResult.changes[0]?.growthType
        });
    }

    // 显示成长通知
    showGrowthNotification(character, growthResult) {
        const changes = growthResult.changes;
        let message = `${character.name} 有了成长！\n`;
        
        changes.forEach(change => {
            const areaName = this.growthSystem.growthTypes[change.area];
            message += `${areaName}：${change.oldLevel.toFixed(1)} → ${change.newLevel.toFixed(1)}\n`;
        });
        
        if (changes.length > 0) {
            const growthType = changes[0].growthType;
            const typeNames = {
                breakthrough: '突破式成长',
                gradual: '渐进式成长',
                temporary_setback: '暂时倒退',
                stable: '稳定期'
            };
            
            message += `成长类型：${typeNames[growthType]}`;
        }
        
        this.showNotification(message, 'growth');
    }

    // 更新交互历史
    updateInteractionHistory(message) {
        // 检查消息中提到的人物
        this.characters.forEach((character, id) => {
            if (message.includes(character.name) || 
                message.includes(character.basicInfo.occupation)) {
                
                // 更新交互计数
                character.interactionCount++;
                character.lastUpdated = new Date().toISOString();
                
                // 记录交互历史
                const history = this.interactionHistory.get(id) || [];
                history.push({
                    timestamp: Date.now(),
                    message: message,
                    type: 'mentioned'
                });
                this.interactionHistory.set(id, history);
                
                // 检查是否需要提升重要性
                if (this.settings.autoUpgrade) {
                    this.importanceManager.checkImportanceUpgrade(id);
                }
            }
        });
    }

    // 处理AI消息
    processAIMessage(message) {
        // 处理AI回复中的人物信息
        // 可以在这里提取新的人物信息或更新现有人物信息
    }

    // 启动定时任务
    startPeriodicTasks() {
        // 定期清理过期数据
        setInterval(() => {
            this.cleanupExpiredData();
        }, this.settings.cleanupInterval);
        
        // 定期保存数据
        setInterval(() => {
            this.saveData();
        }, 5 * 60 * 1000); // 5分钟保存一次
    }

    // 清理过期数据
    cleanupExpiredData() {
        const now = Date.now();
        const expireTime = 24 * 60 * 60 * 1000; // 24小时过期
        
        // 清理交互历史
        this.interactionHistory.forEach((history, characterId) => {
            const recentHistory = history.filter(item => 
                now - item.timestamp < expireTime
            );
            this.interactionHistory.set(characterId, recentHistory);
        });
        
        console.log('清理过期数据完成');
    }

    // 保存数据
    saveData() {
        try {
            const data = {
                characters: Array.from(this.characters.entries()),
                characterIndex: this.characterIndex,
                settings: this.settings,
                timestamp: new Date().toISOString()
            };
            
            localStorage.setItem('layeredCharacterSystemData', JSON.stringify(data));
            console.log('数据保存完成');
        } catch (error) {
            console.error('保存数据失败:', error);
        }
    }

    // 加载数据
    loadData() {
        try {
            const saved = localStorage.getItem('layeredCharacterSystemData');
            if (saved) {
                const data = JSON.parse(saved);
                this.characters = new Map(data.characters);
                this.characterIndex = data.characterIndex;
                console.log('数据加载完成');
            }
        } catch (error) {
            console.error('加载数据失败:', error);
        }
    }

    // 记录事件
    logEvent(eventType, data) {
        const event = {
            type: eventType,
            data: data,
            timestamp: new Date().toISOString()
        };
        
        console.log('事件记录:', event);
        
        // 可以在这里添加事件分析或上报逻辑
    }

    // 显示通知
    showNotification(message, type = 'info') {
        const notification = $(`
            <div class="lcs-notification lcs-notification-${type}">
                ${message}
            </div>
        `);
        
        $('body').append(notification);
        
        setTimeout(() => {
            notification.fadeOut(() => notification.remove());
        }, 3000);
    }

    // 获取系统状态
    getSystemStatus() {
        return {
            characters: this.getCharacterStats(),
            activeEntries: Array.from(this.activeEntries),
            settings: this.settings,
            uptime: Date.now() - (this.startTime || Date.now())
        };
    }

    // 获取人物成长报告
    getCharacterGrowthReport(characterId) {
        const character = this.characters.get(characterId);
        if (!character) {
            return { error: '人物不存在' };
        }
        
        return this.growthSystem.getGrowthReport(character);
    }

    // 工具方法：获取随机项
    getRandomItem(array) {
        return array[Math.floor(Math.random() * array.length)];
    }

    // 工具方法：获取多个随机项
    getRandomItems(array, min, max) {
        const count = Math.floor(Math.random() * (max - min + 1)) + min;
        const shuffled = [...array].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }

    // 工具方法：提取位置
    extractLocation(message) {
        const locations = ['酒馆', '市场', '铁匠铺', '药店', '城门', '旅店', '商店', '街道'];
        return locations.find(location => message.includes(location));
    }
}

// 插件初始化
let plugin;

// 当SillyTavern加载时初始化插件
$(document).ready(() => {
    plugin = new LayeredCharacterSystem();
    plugin.init().catch(error => {
        console.error('插件初始化失败:', error);
    });
});
// 在index.js文件的最后添加以下代码

// 导出插件对象
const pluginInstance = new LayeredCharacterSystem();

// SillyTavern插件规范
if (typeof window !== 'undefined') {
    // 方法1：直接导出插件对象
    window.layeredCharacterWorldbookSystem = pluginInstance;
    
    // 方法2：如果SillyTavern使用特定的插件注册系统
    if (window.SillyTavern && window.SillyTavern.registerPlugin) {
        window.SillyTavern.registerPlugin({
            name: "Layered Character Worldbook System",
            instance: pluginInstance,
            init: async () => {
                await pluginInstance.init();
            }
        });
    }
    
    // 方法3：备用方案
    if (!window.plugins) {
        window.plugins = [];
    }
    window.plugins.push({
        name: "Layered Character Worldbook System",
        instance: pluginInstance
    });
    
    // 自动初始化
    $(document).ready(() => {
        pluginInstance.init().catch(error => {
            console.error('插件初始化失败:', error);
        });
    });
}

// 导出为Node.js模块（如果需要）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LayeredCharacterSystem;
}
