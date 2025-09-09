// LayeredCharacterWorldbookSystem - 优化版
import { SlashCommand } from '../../../slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument } from '../../../slash-commands/SlashCommandArgument.js';
import { commonEnumProviders } from '../../../slash-commands/SlashCommandCommonEnumsProvider.js';
import { SlashCommandParser } from '../../../slash-commands/SlashCommandParser.js';
import { isTrueBoolean } from '../../../utils.js';

export default 'LayeredCharacterWorldbookSystem'; // Init ES module

const context = SillyTavern.getContext();
const settingsKey = 'layeredCharacterWorldbookSystem';

// 优化后的默认设置
const defaultSettings = Object.freeze({
    enabled: true,
    autoGenerate: true,
    maxMainCharacters: 5,
    maxSecondaryCharacters: 15,
    maxBackgroundCharacters: 30,
    tokenBudget: 2000,
    enableGrowthSystem: true,
    autoUpgrade: true,
    triggerCooldown: 5 * 60 * 1000,
    cleanupInterval: 30 * 60 * 1000,
    // AI设置
    useAI: true,
    aiApi: 'main',
    customApiEndpoint: '',
    customApiKey: '',
    apiModel: 'default',
    aiTemperature: 0.8,
    aiMaxTokens: 1000,
    aiFallbackToLocal: true,
    aiTimeout: 30000,
    aiContextLength: 5,
    aiIncludeWorldInfo: true,
    aiIncludeChatHistory: true,
    // 新功能设置
    enableRelationshipNetwork: true,
    enableTimelineManagement: true,
    maxRelationshipsPerCharacter: 10,
    maxTimelineEventsPerCharacter: 50,
    // 性能优化设置
    enableVirtualScrolling: true,
    virtualScrollItemHeight: 60,
    maxCacheSize: 200,
    // 错误处理设置
    enableErrorRecovery: true,
    maxRetryAttempts: 3,
    // 新增UI设置
    uiPosition: { top: '20px', right: '20px' },
    uiTheme: 'dark',
    uiCollapsed: true
});

// 优化后的错误类型
class CharacterSystemError extends Error {
    constructor(type, message, details = {}) {
        super(message);
        this.type = type;
        this.details = details;
        this.timestamp = new Date().toISOString();
        this.userMessage = this.getUserMessage();
    }

    getUserMessage() {
        const messages = {
            'AI_TIMEOUT': 'AI响应超时，请稍后重试或使用本地生成',
            'WORLDBOOK_SYNC': '世界书同步失败，请检查网络连接',
            'VALIDATION_FAILED': '数据验证失败，请检查输入信息',
            'RELATIONSHIP_CREATE': '创建人物关系失败，请重试',
            'TIMELINE_CREATE': '创建时间线事件失败，请重试',
            'PERFORMANCE_LIMIT': '系统负载过高，请稍后再试',
            'DATA_CORRUPTION': '数据损坏，请尝试重新加载页面',
            'NETWORK_ERROR': '网络连接失败，请检查网络设置',
            'UNKNOWN_ERROR': '未知错误，请联系开发者或查看控制台'
        };
        return messages[this.type] || '发生未知错误';
    }
}

// 优化后的数据库类 - 添加分页和缓存
class CharacterDatabase {
    constructor() {
        this.characters = new Map();
        this.nameIndex = new Map();
        this.importanceIndex = new Map();
        this.locationIndex = new Map();
        this.recentlyUsed = new LRUCache(100);
        this.relationshipIndex = new Map();
        this.timelineIndex = new Map();
        this.pageSize = 20;
        this.totalPages = 0;
    }

    addCharacter(character) {
        this.characters.set(character.id, character);
        this.nameIndex.set(character.name.toLowerCase(), character.id);
        
        if (!this.importanceIndex.has(character.importance)) {
            this.importanceIndex.set(character.importance, []);
        }
        this.importanceIndex.get(character.importance).push(character.id);
        
        if (!this.locationIndex.has(character.basicInfo.location)) {
            this.locationIndex.set(character.basicInfo.location, []);
        }
        this.locationIndex.get(character.basicInfo.location).push(character.id);
        
        this.recentlyUsed.set(character.id, character);
        this.updatePagination();
        
        console.log(`✅ 人物已添加到数据库: ${character.name}`);
    }

    updatePagination() {
        this.totalPages = Math.ceil(this.characters.size / this.pageSize);
    }

    getCharactersPage(page = 1) {
        const start = (page - 1) * this.pageSize;
        const end = start + this.pageSize;
        const allCharacters = Array.from(this.characters.values());
        return allCharacters.slice(start, end);
    }

    getCharacter(id) {
        const character = this.characters.get(id);
        if (character) {
            this.recentlyUsed.set(id, character);
        }
        return character;
    }

    findCharacterByName(name) {
        const id = this.nameIndex.get(name.toLowerCase());
        return id ? this.getCharacter(id) : null;
    }

    getCharactersByImportance(importance) {
        const ids = this.importanceIndex.get(importance) || [];
        return ids.map(id => this.getCharacter(id)).filter(Boolean);
    }

    getCharactersByLocation(location) {
        const ids = this.locationIndex.get(location) || [];
        return ids.map(id => this.getCharacter(id)).filter(Boolean);
    }

    removeCharacter(id) {
        const character = this.characters.get(id);
        if (!character) return false;
        
        // 从主存储删除
        this.characters.delete(id);
        
        // 从索引删除
        this.nameIndex.delete(character.name.toLowerCase());
        this.importanceIndex.set(character.importance, 
            (this.importanceIndex.get(character.importance) || []).filter(i => i !== id)
        );
        this.locationIndex.set(character.basicInfo.location,
            (this.locationIndex.get(character.basicInfo.location) || []).filter(i => i !== id)
        );
        this.recentlyUsed.delete(id);
        
        console.log(`✅ 人物已从数据库删除: ${character.name}`);
        return true;
    }

    getAllCharacters() {
        return Array.from(this.characters.values());
    }

    getRecentCharacters(count = 10) {
        return Array.from(this.recentlyUsed.values()).slice(0, count);
    }

    clear() {
        this.characters.clear();
        this.nameIndex.clear();
        this.importanceIndex.clear();
        this.locationIndex.clear();
        this.recentlyUsed.clear();
        this.relationshipIndex.clear();
        this.timelineIndex.clear();
        this.updatePagination();
    }
}

// 优化后的LRU缓存
class LRUCache {
    constructor(maxSize = 100) {
        this.maxSize = maxSize;
        this.cache = new Map();
    }

    set(key, value) {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, value);
    }

    get(key) {
        if (!this.cache.has(key)) return null;
        
        const value = this.cache.get(key);
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
    }

    delete(key) {
        return this.cache.delete(key);
    }

    clear() {
        this.cache.clear();
    }

    values() {
        return this.cache.values();
    }

    keys() {
        return this.cache.keys();
    }
}

// 优化后的人物关系网络管理器 - 减少硬编码
class RelationshipNetworkManager {
    constructor() {
        this.relationships = new Map();
        this.characterRelationships = new Map();
        // 基础关系类型，但允许动态添加
        this.baseRelationshipTypes = new Set([
            '朋友', '敌人', '家人', '恋人', '同事', '师生', '盟友', '竞争对手',
            '崇拜者', '被崇拜者', '保护者', '被保护者', '合作伙伴', '陌生人'
        ]);
        // 动态学习的关系类型
        this.learnedRelationshipTypes = new Set();
        // 关系权重，用于智能选择
        this.relationshipWeights = new Map();
        // 位置-关系映射
        this.locationRelationshipMap = {
            '酒馆': ['朋友', '盟友', '合作伙伴'],
            '市场': ['竞争对手', '陌生人'],
            '铁匠铺': ['同事', '师生'],
            '药店': ['同事', '朋友'],
            '城门': ['陌生人', '敌人'],
            '旅店': ['朋友', '恋人', '陌生人']
        };
        // 职业-关系映射
        this.occupationRelationshipMap = {
            '铁匠': ['同事', '师生', '竞争对手'],
            '药师': ['同事', '朋友'],
            '商人': ['竞争对手', '合作伙伴'],
            '守卫': ['同事', '盟友', '敌人'],
            '魔法师': ['师生', '盟友', '竞争对手']
        };
    }

    // 获取所有关系类型（基础+学习）
    getAllRelationshipTypes() {
        return new Set([...this.baseRelationshipTypes, ...this.learnedRelationshipTypes]);
    }

    // 添加学习到的新关系类型
    addLearnedRelationshipType(type) {
        if (type && !this.baseRelationshipTypes.has(type)) {
            this.learnedRelationshipTypes.add(type);
            console.log(`📚 学习到新关系类型: ${type}`);
        }
    }

    // 智能选择关系类型（基于上下文）
    async selectRelationshipType(context) {
        const allTypes = this.getAllRelationshipTypes();
        
        // 70%概率使用预定义类型，30%概率生成新类型
        if (Math.random() < 0.7) {
            // 基于权重选择
            return this.weightedRandomSelection(allTypes, context);
        } else {
            // AI生成新关系类型
            return await this.generateNewRelationshipType(context);
        }
    }

    // 加权随机选择
    weightedRandomSelection(types, context) {
        const weights = [];
        
        types.forEach(type => {
            let weight = 1; // 基础权重
            
            // 根据上下文调整权重
            if (context.location && this.locationRelationshipMap[context.location]?.includes(type)) {
                weight += 2;
            }
            if (context.occupation && this.occupationRelationshipMap[context.occupation]?.includes(type)) {
                weight += 1.5;
            }
            
            weights.push(weight);
        });
        
        // 加权随机选择
        const totalWeight = weights.reduce((sum, w) => sum + w, 0);
        let random = Math.random() * totalWeight;
        
        for (let i = 0; i < types.length; i++) {
            random -= weights[i];
            if (random <= 0) {
                return Array.from(types)[i];
            }
        }
        
        return Array.from(types)[0];
    }

    // AI生成新关系类型
    async generateNewRelationshipType(context) {
        if (!context.extensionSettings[settingsKey].useAI) {
            return getRandomItem(Array.from(this.baseRelationshipTypes));
        }
        
        const prompt = `
            根据以下上下文，生成一个新颖的人物关系类型：
            地点: ${context.location || '未知'}
            职业: ${context.occupation || '未知'}
            世界设定: ${context.worldSetting || '默认'}
            
            要求:
            1. 关系类型应该简洁明了（1-4个字）
            2. 符合上下文环境
            3. 不要使用常见类型（朋友、敌人、家人等）
            4. 只返回关系类型名称，不要其他解释
        `;
        
        try {
            const response = await callSillyTavernAI(prompt);
            const newType = response.trim();
            
            if (newType && newType.length <= 10) {
                this.addLearnedRelationshipType(newType);
                return newType;
            }
        } catch (error) {
            console.warn('生成新关系类型失败:', error);
        }
        
        return getRandomItem(Array.from(this.baseRelationshipTypes));
    }

    // 创建关系（使用智能选择）
    async createRelationship(fromCharacterId, toCharacterId, properties = {}) {
        const fromChar = characterDatabase.getCharacter(fromCharacterId);
        const toChar = characterDatabase.getCharacter(toCharacterId);
        
        if (!fromChar || !toChar) {
            throw new CharacterSystemError('VALIDATION_FAILED', '人物不存在');
        }
        
        const context = {
            fromCharacterId,
            toCharacterId,
            location: fromChar.basicInfo.location,
            occupation: fromChar.basicInfo.occupation,
            worldSetting: fromChar.worldSetting,
            extensionSettings: context.extensionSettings
        };
        
        const type = properties.type || await this.selectRelationshipType(context);
        
        if (!this.isValidRelationshipType(type)) {
            throw new CharacterSystemError('VALIDATION_FAILED', 
                `无效的关系类型: ${type}`, { type });
        }
        
        const relationshipId = this.generateRelationshipId(fromCharacterId, toCharacterId);
        
        const relationship = {
            id: relationshipId,
            fromCharacterId,
            toCharacterId,
            type,
            strength: properties.strength || 0.5,
            sentiment: properties.sentiment || 0,
            description: properties.description || '',
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            lastInteraction: properties.lastInteraction || null,
            bidirectional: properties.bidirectional || false,
            tags: properties.tags || [],
            metadata: properties.metadata || {}
        };
        
        this.relationships.set(relationshipId, relationship);
        this.addCharacterRelationship(fromCharacterId, relationshipId);
        
        if (relationship.bidirectional) {
            this.addCharacterRelationship(toCharacterId, relationshipId);
        }
        
        console.log(`✅ 关系已创建: ${fromChar.name} -> ${toChar.name} (${type})`);
        return relationship;
    }

    // 更新关系
    updateRelationship(relationshipId, updates) {
        const relationship = this.relationships.get(relationshipId);
        if (!relationship) {
            throw new CharacterSystemError('RELATIONSHIP_CREATE', 
                `关系不存在: ${relationshipId}`, { relationshipId });
        }
        Object.assign(relationship, updates);
        relationship.lastUpdated = new Date().toISOString();
        console.log(`✅ 关系已更新: ${relationshipId}`);
        return relationship;
    }

    // 删除关系
    deleteRelationship(relationshipId) {
        const relationship = this.relationships.get(relationshipId);
        if (!relationship) return false;
        this.relationships.delete(relationshipId);
        
        // 从人物关系索引中删除
        this.removeCharacterRelationship(relationship.fromCharacterId, relationshipId);
        if (relationship.bidirectional) {
            this.removeCharacterRelationship(relationship.toCharacterId, relationshipId);
        }
        console.log(`✅ 关系已删除: ${relationshipId}`);
        return true;
    }

    // 获取人物的所有关系
    getCharacterRelationships(characterId) {
        const relationshipIds = this.characterRelationships.get(characterId) || [];
        return relationshipIds.map(id => this.relationships.get(id)).filter(Boolean);
    }

    // 获取两个人物之间的关系
    getRelationship(characterId1, characterId2) {
        const relationshipId = this.generateRelationshipId(characterId1, characterId2);
        return this.relationships.get(relationshipId);
    }

    // 获取关系网络分析
    getNetworkAnalysis(characterId) {
        const relationships = this.getCharacterRelationships(characterId);
        
        const analysis = {
            totalConnections: relationships.length,
            relationshipTypes: {},
            averageStrength: 0,
            sentimentDistribution: { positive: 0, neutral: 0, negative: 0 },
            strongestRelationships: [],
            mostRecentInteractions: []
        };
        
        if (relationships.length === 0) return analysis;
        
        let totalStrength = 0;
        
        relationships.forEach(rel => {
            // 统计关系类型
            analysis.relationshipTypes[rel.type] = (analysis.relationshipTypes[rel.type] || 0) + 1;
            
            // 计算强度总和
            totalStrength += rel.strength;
            
            // 统计情感分布
            if (rel.sentiment > 0.3) {
                analysis.sentimentDistribution.positive++;
            } else if (rel.sentiment < -0.3) {
                analysis.sentimentDistribution.negative++;
            } else {
                analysis.sentimentDistribution.neutral++;
            }
            
            // 记录最强关系
            if (rel.strength > 0.7) {
                analysis.strongestRelationships.push(rel);
            }
            
            // 记录最近互动
            if (rel.lastInteraction) {
                analysis.mostRecentInteractions.push(rel);
            }
        });
        
        analysis.averageStrength = totalStrength / relationships.length;
        
        // 排序
        analysis.strongestRelationships.sort((a, b) => b.strength - a.strength);
        analysis.mostRecentInteractions.sort((a, b) => 
            new Date(b.lastInteraction) - new Date(a.lastInteraction)
        );
        
        return analysis;
    }

    // 生成关系网络文本描述（用于AI）
    generateNetworkTextForAI(characterId, context) {
        const relationships = this.getCharacterRelationships(characterId);
        const analysis = this.getNetworkAnalysis(characterId);
        
        // 根据上下文过滤相关关系
        const relevantRelationships = this.filterRelevantRelationships(relationships, context);
        
        let text = `${characterId}的人际关系网络：\n\n`;
        
        // 基础统计
        text += `关系总数：${analysis.totalConnections}\n`;
        text += `平均关系强度：${(analysis.averageStrength * 100).toFixed(1)}%\n\n`;
        
        // 主要关系类型
        text += '主要关系类型：\n';
        Object.entries(analysis.relationshipTypes).forEach(([type, count]) => {
            text += `- ${type}：${count}个\n`;
        });
        text += '\n';
        
        // 重要关系详情
        text += '重要关系详情：\n';
        relevantRelationships.slice(0, 5).forEach(rel => {
            const targetChar = characterDatabase.getCharacter(rel.toCharacterId);
            const targetName = targetChar ? targetChar.name : rel.toCharacterId;
            
            text += `- 与${targetName}：${rel.type}关系`;
            text += `（强度：${(rel.strength * 100).toFixed(1)}%`;
            
            if (rel.sentiment !== 0) {
                const sentiment = rel.sentiment > 0 ? '积极' : '消极';
                text += `，情感倾向：${sentiment}`;
            }
            
            if (rel.lastInteraction) {
                const timeAgo = this.getTimeAgo(rel.lastInteraction);
                text += `，最近${timeAgo}互动`;
            }
            
            text += '）\n';
        });
        
        return text;
    }

    // 辅助方法
    generateRelationshipId(fromId, toId) {
        return `REL_${fromId}_${toId}`.toUpperCase();
    }

    isValidRelationshipType(type) {
        return this.getAllRelationshipTypes().has(type);
    }

    addCharacterRelationship(characterId, relationshipId) {
        if (!this.characterRelationships.has(characterId)) {
            this.characterRelationships.set(characterId, []);
        }
        this.characterRelationships.get(characterId).push(relationshipId);
    }

    removeCharacterRelationship(characterId, relationshipId) {
        const relationships = this.characterRelationships.get(characterId);
        if (relationships) {
            const index = relationships.indexOf(relationshipId);
            if (index > -1) {
                relationships.splice(index, 1);
            }
        }
    }

    filterRelevantRelationships(relationships, context) {
        // 根据上下文相关性过滤关系
        return relationships
            .filter(rel => rel.strength > 0.3) // 只保留较强关系
            .sort((a, b) => b.strength - a.strength)
            .slice(0, 10); // 最多返回10个
    }

    getTimeAgo(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return '今天';
        if (diffDays === 1) return '昨天';
        if (diffDays < 7) return `${diffDays}天前`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
        return `${Math.floor(diffDays / 30)}个月前`;
    }
}

// 时间线管理器
class TimelineManager {
    constructor() {
        this.events = new Map(); // eventId -> event
        this.characterEvents = new Map(); // characterId -> eventId[]
        this.eventTypes = new Set([
            'birth', 'death', 'meeting', 'separation', 'conflict', 'resolution',
            'achievement', 'failure', 'discovery', 'journey', 'transformation',
            'relationship_change', 'importance_change', 'location_change'
        ]);
    }

    // 创建时间线事件
    createTimelineEvent(characterId, type, title, description, date, properties = {}) {
        if (!this.isValidEventType(type)) {
            throw new CharacterSystemError('VALIDATION_FAILED', 
                `无效的事件类型: ${type}`, { type, validTypes: Array.from(this.eventTypes) });
        }
        const eventId = this.generateEventId();
        
        const event = {
            id: eventId,
            characterId,
            type,
            title,
            description,
            date: this.parseDate(date),
            createdAt: new Date().toISOString(),
            importance: properties.importance || 0.5, // 0-1之间
            impact: properties.impact || '',
            participants: properties.participants || [],
            location: properties.location || '',
            tags: properties.tags || [],
            metadata: properties.metadata || {},
            relatedEvents: properties.relatedEvents || []
        };
        this.events.set(eventId, event);
        this.addCharacterEvent(characterId, eventId);
        console.log(`✅ 时间线事件已创建: ${title} (${type})`);
        return event;
    }

    // 更新事件
    updateTimelineEvent(eventId, updates) {
        const event = this.events.get(eventId);
        if (!event) {
            throw new CharacterSystemError('TIMELINE_CREATE', 
                `事件不存在: ${eventId}`, { eventId });
        }
        Object.assign(event, updates);
        
        if (updates.date) {
            event.date = this.parseDate(updates.date);
        }
        console.log(`✅ 时间线事件已更新: ${eventId}`);
        return event;
    }

    // 删除事件
    deleteTimelineEvent(eventId) {
        const event = this.events.get(eventId);
        if (!event) return false;
        this.events.delete(eventId);
        this.removeCharacterEvent(event.characterId, eventId);
        console.log(`✅ 时间线事件已删除: ${eventId}`);
        return true;
    }

    // 获取人物的时间线
    getCharacterTimeline(characterId, options = {}) {
        const eventIds = this.characterEvents.get(characterId) || [];
        let events = eventIds.map(id => this.events.get(id)).filter(Boolean);
        
        // 排序
        events.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // 过滤
        if (options.type) {
            events = events.filter(event => event.type === options.type);
        }
        if (options.startDate) {
            events = events.filter(event => new Date(event.date) >= new Date(options.startDate));
        }
        if (options.endDate) {
            events = events.filter(event => new Date(event.date) <= new Date(options.endDate));
        }
        if (options.minImportance) {
            events = events.filter(event => event.importance >= options.minImportance);
        }
        
        // 分页
        if (options.limit) {
            events = events.slice(0, options.limit);
        }
        
        return events;
    }

    // 获取时间线分析
    getTimelineAnalysis(characterId) {
        const events = this.getCharacterTimeline(characterId);
        
        const analysis = {
            totalEvents: events.length,
            eventTypeDistribution: {},
            timeDistribution: {
                recent: 0,    // 最近30天
                medium: 0,    // 最近90天
                long: 0       // 超过90天
            },
            importanceDistribution: {
                high: 0,      // > 0.7
                medium: 0,    // 0.3 - 0.7
                low: 0        // < 0.3
            },
            keyEvents: [],
            eventTrends: [],
            characterDevelopment: []
        };
        
        if (events.length === 0) return analysis;
        
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        
        events.forEach(event => {
            // 事件类型分布
            analysis.eventTypeDistribution[event.type] = 
                (analysis.eventTypeDistribution[event.type] || 0) + 1;
            
            // 时间分布
            const eventDate = new Date(event.date);
            if (eventDate >= thirtyDaysAgo) {
                analysis.timeDistribution.recent++;
            } else if (eventDate >= ninetyDaysAgo) {
                analysis.timeDistribution.medium++;
            } else {
                analysis.timeDistribution.long++;
            }
            
            // 重要性分布
            if (event.importance > 0.7) {
                analysis.importanceDistribution.high++;
            } else if (event.importance >= 0.3) {
                analysis.importanceDistribution.medium++;
            } else {
                analysis.importanceDistribution.low++;
            }
            
            // 关键事件
            if (event.importance > 0.8) {
                analysis.keyEvents.push(event);
            }
            
            // 人物发展事件
            if (['transformation', 'importance_change', 'relationship_change'].includes(event.type)) {
                analysis.characterDevelopment.push(event);
            }
        });
        
        // 分析事件趋势
        analysis.eventTrends = this.analyzeEventTrends(events);
        
        return analysis;
    }

    // 生成时间线文本描述（用于AI）
    generateTimelineTextForAI(characterId, context) {
        const events = this.getCharacterTimeline(characterId, { 
            limit: 15, 
            minImportance: 0.4 
        });
        const analysis = this.getTimelineAnalysis(characterId);
        
        let text = `${characterId}的重要时间线事件：\n\n`;
        
        // 基础统计
        text += `总事件数：${analysis.totalEvents}\n`;
        text += `高重要性事件：${analysis.importanceDistribution.high}个\n\n`;
        
        // 按时间分组显示事件
        const timeGroups = this.groupEventsByTime(events);
        
        Object.entries(timeGroups).forEach(([timeGroup, groupEvents]) => {
            text += `${timeGroup}：\n`;
            groupEvents.forEach(event => {
                const dateStr = new Date(event.date).toLocaleDateString();
                text += `- ${dateStr}：${event.title}`;
                
                if (event.importance > 0.7) {
                    text += '（重要）';
                }
                
                text += `\n  ${event.description}\n`;
            });
            text += '\n';
        });
        
        // 人物发展总结
        if (analysis.characterDevelopment.length > 0) {
            text += '关键发展节点：\n';
            analysis.characterDevelopment.forEach(event => {
                const dateStr = new Date(event.date).toLocaleDateString();
                text += `- ${dateStr}：${event.title}\n`;
            });
        }
        
        return text;
    }

    // 辅助方法
    generateEventId() {
        return `EVENT_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`.toUpperCase();
    }

    isValidEventType(type) {
        return this.eventTypes.has(type);
    }

    parseDate(date) {
        if (date instanceof Date) return date;
        if (typeof date === 'string') return new Date(date);
        return new Date(); // 默认当前时间
    }

    addCharacterEvent(characterId, eventId) {
        if (!this.characterEvents.has(characterId)) {
            this.characterEvents.set(characterId, []);
        }
        this.characterEvents.get(characterId).push(eventId);
    }

    removeCharacterEvent(characterId, eventId) {
        const events = this.characterEvents.get(characterId);
        if (events) {
            const index = events.indexOf(eventId);
            if (index > -1) {
                events.splice(index, 1);
            }
        }
    }

    groupEventsByTime(events) {
        const groups = {
            '最近30天': [],
            '30-90天': [],
            '90天前': []
        };
        
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        
        events.forEach(event => {
            const eventDate = new Date(event.date);
            if (eventDate >= thirtyDaysAgo) {
                groups['最近30天'].push(event);
            } else if (eventDate >= ninetyDaysAgo) {
                groups['30-90天'].push(event);
            } else {
                groups['90天前'].push(event);
            }
        });
        
        return groups;
    }

    analyzeEventTrends(events) {
        // 简单的趋势分析
        const trends = [];
        
        if (events.length < 3) return trends;
        
        // 按时间排序
        const sortedEvents = [...events].sort((a, b) => 
            new Date(a.date) - new Date(b.date)
        );
        
        // 分析事件频率变化
        const recentEvents = sortedEvents.slice(-5);
        const olderEvents = sortedEvents.slice(0, 5);
        
        if (recentEvents.length > olderEvents.length) {
            trends.push('近期事件频率增加');
        } else if (recentEvents.length < olderEvents.length) {
            trends.push('近期事件频率减少');
        }
        
        // 分析重要性变化
        const recentImportance = recentEvents.reduce((sum, e) => sum + e.importance, 0) / recentEvents.length;
        const olderImportance = olderEvents.reduce((sum, e) => sum + e.importance, 0) / olderEvents.length;
        
        if (recentImportance > olderImportance + 0.2) {
            trends.push('近期事件重要性提升');
        } else if (recentImportance < olderImportance - 0.2) {
            trends.push('近期事件重要性降低');
        }
        
        return trends;
    }
}

// 错误恢复管理器
class ErrorRecoveryManager {
    constructor() {
        this.retryStrategies = new Map();
        this.fallbackMethods = new Map();
        this.errorLog = [];
        this.maxLogSize = 100;
    }

    registerRetryStrategy(errorType, strategy) {
        this.retryStrategies.set(errorType, strategy);
    }

    registerFallbackMethod(errorType, method) {
        this.fallbackMethods.set(errorType, method);
    }

    async handleError(error, context = {}) {
        // 记录错误
        this.logError(error, context);
        
        // 尝试重试
        if (context.retryCount < context.maxRetries) {
            const strategy = this.retryStrategies.get(error.type);
            if (strategy) {
                console.log(`🔄 尝试重试 ${error.type} 错误...`);
                return await strategy(error, context);
            }
        }
        
        // 尝试回退方法
        const fallback = this.fallbackMethods.get(error.type);
        if (fallback) {
            console.log(`🔄 使用回退方法处理 ${error.type} 错误...`);
            return await fallback(error, context);
        }
        
        // 无法恢复，抛出错误
        throw error;
    }

    logError(error, context) {
        const errorEntry = {
            error: {
                type: error.type,
                message: error.message,
                details: error.details
            },
            context,
            timestamp: new Date().toISOString()
        };
        
        this.errorLog.push(errorEntry);
        
        // 保持日志大小限制
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog.shift();
        }
        
        console.error('🚨 错误记录:', errorEntry);
    }

    getErrorStats() {
        const stats = {
            totalErrors: this.errorLog.length,
            errorTypes: {},
            recentErrors: this.errorLog.slice(-10),
            recoveryRate: 0
        };
        
        this.errorLog.forEach(entry => {
            const type = entry.error.type;
            stats.errorTypes[type] = (stats.errorTypes[type] || 0) + 1;
        });
        
        return stats;
    }
}

// 性能监控器
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            characterOperations: 0,
            relationshipOperations: 0,
            timelineOperations: 0,
            aiCalls: 0,
            errors: 0,
            averageResponseTime: 0
        };
        this.operationTimes = [];
        this.maxOperationTimes = 100;
    }

    startOperation(type) {
        return {
            type,
            startTime: performance.now(),
            end: () => this.endOperation(this.startOperation(type))
        };
    }

    endOperation(operation) {
        const duration = performance.now() - operation.startTime;
        this.operationTimes.push({
            type: operation.type,
            duration,
            timestamp: Date.now()
        });
        
        // 保持操作时间记录大小限制
        if (this.operationTimes.length > this.maxOperationTimes) {
            this.operationTimes.shift();
        }
        
        // 更新指标
        this.metrics[`${operation.type}Operations`] = 
            (this.metrics[`${operation.type}Operations`] || 0) + 1;
        
        // 计算平均响应时间
        const recentTimes = this.operationTimes.slice(-20);
        this.metrics.averageResponseTime = 
            recentTimes.reduce((sum, op) => sum + op.duration, 0) / recentTimes.length;
        
        // 检查性能警告
        if (duration > 1000) { // 超过1秒
            console.warn(`⚠️ 性能警告: ${operation.type} 操作耗时 ${duration.toFixed(2)}ms`);
        }
    }

    recordError(type) {
        this.metrics.errors++;
        console.error(`📊 错误记录: ${type}`);
    }

    getMetrics() {
        return {
            ...this.metrics,
            recentOperations: this.operationTimes.slice(-10),
            performanceScore: this.calculatePerformanceScore()
        };
    }

    calculatePerformanceScore() {
        if (this.operationTimes.length === 0) return 100;
        
        const avgTime = this.metrics.averageResponseTime;
        const errorRate = this.metrics.errors / Math.max(1, 
            this.metrics.characterOperations + this.metrics.relationshipOperations + this.metrics.timelineOperations);
        
        // 性能评分计算（0-100）
        let score = 100;
        
        // 响应时间惩罚
        if (avgTime > 500) score -= 20;
        else if (avgTime > 200) score -= 10;
        
        // 错误率惩罚
        score -= errorRate * 50;
        
        return Math.max(0, Math.min(100, score));
    }
}

// 优化后的人物生成器 - 减少硬编码
class CharacterGenerator {
    constructor() {
        // 基础模板，但允许动态扩展
        this.baseTemplates = {
            names: {
                male: ["李明", "张强", "王磊", "刘伟", "陈杰"],
                female: ["王芳", "李娜", "张丽", "刘敏", "陈静"],
                surname: ["欧阳", "司马", "上官", "独孤", "南宫"]
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
        
        // 动态学习的模板
        this.learnedTemplates = {
            names: { male: [], female: [], surname: [] },
            personalities: { main: [], secondary: [], background: [] },
            occupations: { main: [], secondary: [], background: [] },
            backgrounds: { main: [], secondary: [], background: [] }
        };
        
        // 文化特定模板
        this.culturalTemplates = new Map();
    }

    // 添加学习到的新模板
    addLearnedTemplate(category, type, value) {
        if (this.learnedTemplates[category] && this.learnedTemplates[category][type]) {
            this.learnedTemplates[category][type].push(value);
            console.log(`📚 学习到新${category}模板: ${value}`);
        }
    }

    // 添加文化特定模板
    addCulturalTemplate(culture, templates) {
        this.culturalTemplates.set(culture, templates);
    }

    // 智能生成名字
    generateName(gender, worldSetting) {
        const culture = worldSetting?.culture || 'default';
        const culturalData = this.culturalTemplates.get(culture);
        
        if (culturalData && culturalData.names && culturalData.names[gender]) {
            return this.selectFromWeightedList(culturalData.names[gender]);
        }
        
        // 使用基础模板 + 学习模板
        const allNames = [
            ...this.baseTemplates.names[gender],
            ...this.learnedTemplates.names[gender]
        ];
        
        return getRandomItem(allNames);
    }

    // 智能生成性格
    async generatePersonality(importance, context) {
        // 70%概率使用模板，30%概率AI生成
        if (Math.random() < 0.7) {
            const allPersonalities = [
                ...this.baseTemplates.personalities[importance],
                ...this.learnedTemplates.personalities[importance]
            ];
            
            return getRandomItem(allPersonalities);
        } else {
            return await this.generatePersonalityWithAI(importance, context);
        }
    }

    // AI生成性格
    async generatePersonalityWithAI(importance, context) {
        if (!context.extensionSettings[settingsKey].useAI) {
            return getRandomItem(this.baseTemplates.personalities[importance]);
        }
        
        const importanceNames = {
            main: '主要人物',
            secondary: '次要人物',
            background: '背景人物'
        };
        
        const prompt = `
            为${importanceNames[importance]}生成一个独特的性格描述。
            世界设定: ${context.worldSetting || '默认'}
            职业: ${context.occupation || '未知'}
            
            要求:
            1. 性格应该立体、有深度
            2. 包含优点和缺点
            3. 符合世界设定
            4. 长度在20-50字之间
            5. 不要使用常见模板
        `;
        
        try {
            const response = await callSillyTavernAI(prompt);
            const personality = response.trim();
            
            if (personality && personality.length >= 10 && personality.length <= 100) {
                this.addLearnedTemplate('personalities', importance, personality);
                return personality;
            }
        } catch (error) {
            console.warn('AI生成性格失败:', error);
        }
        
        return getRandomItem(this.baseTemplates.personalities[importance]);
    }

    // 从加权列表中选择
    selectFromWeightedList(items) {
        if (!Array.isArray(items) || items.length === 0) {
            return '';
        }
        
        // 简单实现：随机选择
        return getRandomItem(items);
    }
}

// 优化后的悬浮球UI组件
class FloatingBallUI {
    constructor() {
        this.container = null;
        this.floatingBall = null;
        this.controlPanel = null;
        this.isVisible = false;
        this.isDragging = false;
        this.currentX = 0;
        this.currentY = 0;
        this.initialX = 0;
        this.initialY = 0;
        this.xOffset = 0;
        this.yOffset = 0;
        
        this.init();
    }

    init() {
        this.createFloatingBall();
        this.createControlPanel();
        this.setupEventListeners();
    }

    createFloatingBall() {
        this.floatingBall = document.createElement('div');
        this.floatingBall.id = 'lcs-floating-ball';
        this.floatingBall.className = 'lcs-floating-ball';
        this.floatingBall.innerHTML = `
            <div class="lcs-ball-icon">
                <i class="fas fa-users"></i>
            </div>
            <div class="lcs-ball-badge">0</div>
        `;
        
        document.body.appendChild(this.floatingBall);
    }

    createControlPanel() {
        this.controlPanel = document.createElement('div');
        this.controlPanel.id = 'lcs-control-panel';
        this.controlPanel.className = 'lcs-control-panel';
        this.controlPanel.innerHTML = `
            <div class="lcs-panel-header">
                <h3>人物世界书系统</h3>
                <button class="lcs-close-btn">&times;</button>
            </div>
            <div class="lcs-panel-content">
                <div class="lcs-stats-section">
                    <h4>统计信息</h4>
                    <div class="lcs-stats-grid">
                        <div class="lcs-stat-item">
                            <span class="lcs-stat-value">0</span>
                            <span class="lcs-stat-label">总人数</span>
                        </div>
                        <div class="lcs-stat-item">
                            <span class="lcs-stat-value">0</span>
                            <span class="lcs-stat-label">主要人物</span>
                        </div>
                        <div class="lcs-stat-item">
                            <span class="lcs-stat-value">0</span>
                            <span class="lcs-stat-label">次要人物</span>
                        </div>
                        <div class="lcs-stat-item">
                            <span class="lcs-stat-value">0</span>
                            <span class="lcs-stat-label">背景人物</span>
                        </div>
                    </div>
                </div>
                
                <div class="lcs-actions-section">
                    <h4>快速操作</h4>
                    <div class="lcs-actions-grid">
                        <button class="lcs-action-btn" data-action="generate">
                            <i class="fas fa-plus"></i> 生成人物
                        </button>
                        <button class="lcs-action-btn" data-action="index">
                            <i class="fas fa-list"></i> 查看索引
                        </button>
                        <button class="lcs-action-btn" data-action="relations">
                            <i class="fas fa-project-diagram"></i> 关系网络
                        </button>
                        <button class="lcs-action-btn" data-action="timeline">
                            <i class="fas fa-history"></i> 时间线
                        </button>
                    </div>
                </div>
                
                <div class="lcs-characters-section">
                    <h4>最近人物</h4>
                    <div class="lcs-characters-list"></div>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.controlPanel);
    }

    setupEventListeners() {
        // 悬浮球点击事件
        this.floatingBall.addEventListener('click', (e) => {
            if (!this.isDragging) {
                this.togglePanel();
            }
        });

        // 拖动事件
        this.floatingBall.addEventListener('mousedown', this.dragStart.bind(this));
        document.addEventListener('mousemove', this.drag.bind(this));
        document.addEventListener('mouseup', this.dragEnd.bind(this));

        // 关闭按钮
        const closeBtn = this.controlPanel.querySelector('.lcs-close-btn');
        closeBtn.addEventListener('click', () => {
            this.hidePanel();
        });

        // 操作按钮
        const actionBtns = this.controlPanel.querySelectorAll('.lcs-action-btn');
        actionBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.handleAction(action);
            });
        });
    }

    dragStart(e) {
        this.initialX = e.clientX - this.xOffset;
        this.initialY = e.clientY - this.yOffset;

        if (e.target === this.floatingBall) {
            this.isDragging = true;
        }
    }

    drag(e) {
        if (this.isDragging) {
            e.preventDefault();
            this.currentX = e.clientX - this.initialX;
            this.currentY = e.clientY - this.initialY;

            this.xOffset = this.currentX;
            this.yOffset = this.currentY;

            this.floatingBall.style.transform = `translate(${this.currentX}px, ${this.currentY}px)`;
        }
    }

    dragEnd(e) {
        this.initialX = this.currentX;
        this.initialY = this.currentY;
        this.isDragging = false;
    }

    togglePanel() {
        if (this.isVisible) {
            this.hidePanel();
        } else {
            this.showPanel();
        }
    }

    showPanel() {
        this.controlPanel.classList.add('lcs-panel-visible');
        this.isVisible = true;
        this.updateContent();
    }

    hidePanel() {
        this.controlPanel.classList.remove('lcs-panel-visible');
        this.isVisible = false;
    }

    updateContent() {
        // 更新统计信息
        const stats = getCharacterStats();
        const statValues = this.controlPanel.querySelectorAll('.lcs-stat-value');
        statValues[0].textContent = stats.total;
        statValues[1].textContent = stats.main;
        statValues[2].textContent = stats.secondary;
        statValues[3].textContent = stats.background;

        // 更新徽章
        const badge = this.floatingBall.querySelector('.lcs-ball-badge');
        badge.textContent = stats.total;

        // 更新最近人物列表
        this.updateRecentCharacters();
    }

    updateRecentCharacters() {
        const listContainer = this.controlPanel.querySelector('.lcs-characters-list');
        const recentCharacters = characterDatabase.getRecentCharacters(5);
        
        listContainer.innerHTML = '';
        
        if (recentCharacters.length === 0) {
            listContainer.innerHTML = '<div class="lcs-empty-state">暂无人物</div>';
            return;
        }
        
        recentCharacters.forEach(character => {
            const item = document.createElement('div');
            item.className = 'lcs-character-item';
            item.innerHTML = `
                <div class="lcs-character-info">
                    <div class="lcs-character-name">${character.name}</div>
                    <div class="lcs-character-details">${character.basicInfo.occupation} · ${importanceLevels[character.importance].name}</div>
                </div>
                <div class="lcs-character-actions">
                    <button class="lcs-character-btn" data-action="view" data-id="${character.id}">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="lcs-character-btn" data-action="edit" data-id="${character.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            `;
            
            listContainer.appendChild(item);
        });
    }

    handleAction(action) {
        switch (action) {
            case 'generate':
                handleCharacterGeneration('手动生成');
                break;
            case 'index':
                handleIndexQuery();
                break;
            case 'relations':
                this.showRelationshipNetwork();
                break;
            case 'timeline':
                this.showTimeline();
                break;
        }
    }

    showRelationshipNetwork() {
        // 实现关系网络可视化
        console.log('显示关系网络');
        showNotification('关系网络功能开发中', 'info');
    }

    showTimeline() {
        // 实现时间线可视化
        console.log('显示时间线');
        showNotification('时间线功能开发中', 'info');
    }
}

// 全局变量和实例
const characterDatabase = new CharacterDatabase();
const relationshipNetworkManager = new RelationshipNetworkManager();
const timelineManager = new TimelineManager();
const errorRecoveryManager = new ErrorRecoveryManager();
const characterGenerator = new CharacterGenerator();
const performanceMonitor = new PerformanceMonitor();
const floatingBallUI = new FloatingBallUI();

// 人物重要性定义
const importanceLevels = {
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

// 基础模板（保留用于回退）
const characterTemplates = {
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
const triggerKeywords = {
    generate: ['遇到', '看见', '发现', '认识', '碰到', '陌生人', '路人', '居民', '村民', '市民'],
    index: ['人物索引', '角色列表', '所有人物', '人物总览', '有哪些人', '人物统计'],
    location: ['酒馆', '市场', '铁匠铺', '药店', '城门', '旅店', '商店', '街道'],
    relationship: ['朋友', '敌人', '家人', '恋人', '同事', '师生', '盟友', '竞争对手'],
    timeline: ['时间线', '经历', '历史', '过去', '回忆', '事件', '发生']
};

// 世界书管理器
class WorldBookManager {
    constructor() {
        this.indexEntryId = 'CHARACTER_INDEX';
        this.worldBookCache = null;
        this.cacheExpiry = 0;
    }

    async getCurrentWorldBook() {
        try {
            if (this.worldBookCache && Date.now() < this.cacheExpiry) {
                return this.worldBookCache;
            }
            
            if (window.worldbook && window.worldbook.getWorldBook) {
                this.worldBookCache = await window.worldbook.getWorldBook();
                this.cacheExpiry = Date.now() + 60000;
                return this.worldBookCache;
            }
            
            const worldbookData = this.getWorldBookFromDOM();
            if (worldbookData) {
                this.worldBookCache = worldbookData;
                this.cacheExpiry = Date.now() + 60000;
                return worldbookData;
            }
            
            return this.createDefaultWorldBook();
        } catch (error) {
            console.error('获取世界书失败:', error);
            return this.createDefaultWorldBook();
        }
    }

    getWorldBookFromDOM() {
        try {
            const worldbookElement = document.querySelector('#worldbook');
            if (!worldbookElement) return null;
            
            const entries = [];
            const entryElements = worldbookElement.querySelectorAll('.world_book_entry');
            
            entryElements.forEach(entry => {
                const id = entry.dataset.id;
                const name = entry.querySelector('.entry_name')?.textContent || '';
                const content = entry.querySelector('.entry_content')?.textContent || '';
                const keys = Array.from(entry.querySelectorAll('.entry_key')).map(key => key.textContent);
                
                entries.push({ id, name, content, keys });
            });
            
            return { entries };
        } catch (error) {
            console.error('从 DOM 获取世界书失败:', error);
            return null;
        }
    }

    createDefaultWorldBook() {
        return {
            entries: [],
            metadata: {
                name: '默认世界书',
                created: new Date().toISOString(),
                version: '1.0'
            }
        };
    }

    async updateIndexEntry() {
        try {
            const indexContent = generateIndexContent();
            
            if (window.worldbook && window.worldbook.updateEntry) {
                await window.worldbook.updateEntry({
                    id: this.indexEntryId,
                    name: '人物索引',
                    content: indexContent,
                    keys: ['人物', '角色', '索引', 'character', 'npc'],
                    permanent: true,
                    forceUpdate: true
                });
                return;
            }
            
            this.updateIndexEntryViaDOM(indexContent);
        } catch (error) {
            console.error('更新索引条目失败:', error);
        }
    }

    updateIndexEntryViaDOM(content) {
        try {
            let indexEntry = document.querySelector(`[data-id="${this.indexEntryId}"]`);
            
            if (!indexEntry) {
                indexEntry = this.createEntryElement({
                    id: this.indexEntryId,
                    name: '人物索引',
                    content: content,
                    keys: ['人物', '角色', '索引', 'character', 'npc']
                });
                
                const worldbook = document.querySelector('#worldbook_entries');
                if (worldbook) {
                    worldbook.appendChild(indexEntry);
                }
            } else {
                const contentElement = indexEntry.querySelector('.entry_content');
                if (contentElement) {
                    contentElement.textContent = content;
                }
            }
            
            this.triggerWorldBookUpdate();
        } catch (error) {
            console.error('通过 DOM 更新索引条目失败:', error);
        }
    }

    async createCharacterEntry(character) {
        const operation = performanceMonitor.startOperation('character');
        
        try {
            const content = this.formatCharacterForWorldBook(character);
            
            if (window.worldbook && window.worldbook.createEntry) {
                await window.worldbook.createEntry({
                    id: character.id,
                    name: character.name,
                    content: content,
                    keys: character.keys,
                    permanent: false,
                    metadata: {
                        importance: character.importance,
                        worldSetting: character.worldSetting,
                        aiGenerated: character.aiGenerated || false,
                        createdAt: character.createdAt
                    }
                });
                operation.end();
                return;
            }
            
            this.createCharacterEntryViaDOM(character, content);
            operation.end();
        } catch (error) {
            operation.end();
            performanceMonitor.recordError('worldbook');
            throw error;
        }
    }

    createCharacterEntryViaDOM(character, content) {
        try {
            const entryElement = this.createEntryElement({
                id: character.id,
                name: character.name,
                content: content,
                keys: character.keys,
                metadata: {
                    importance: character.importance,
                    worldSetting: character.worldSetting,
                    aiGenerated: character.aiGenerated || false,
                    createdAt: character.createdAt
                }
            });
            
            const worldbook = document.querySelector('#worldbook_entries');
            if (worldbook) {
                worldbook.appendChild(entryElement);
            }
            
            this.triggerWorldBookUpdate();
            console.log(`✅ 世界书条目创建成功: ${character.name}`);
        } catch (error) {
            console.error('通过 DOM 创建人物条目失败:', error);
        }
    }

    async updateCharacterEntry(character) {
        const operation = performanceMonitor.startOperation('character');
        
        try {
            const content = this.formatCharacterForWorldBook(character);
            
            if (window.worldbook && window.worldbook.updateEntry) {
                await window.worldbook.updateEntry({
                    id: character.id,
                    name: character.name,
                    content: content,
                    keys: character.keys,
                    permanent: false,
                    metadata: {
                        importance: character.importance,
                        worldSetting: character.worldSetting,
                        aiGenerated: character.aiGenerated || false,
                        lastUpdated: character.lastUpdated
                    }
                });
                operation.end();
                return;
            }
            
            this.updateCharacterEntryViaDOM(character, content);
            operation.end();
        } catch (error) {
            operation.end();
            performanceMonitor.recordError('worldbook');
            throw error;
        }
    }

    updateCharacterEntryViaDOM(character, content) {
        try {
            const entryElement = document.querySelector(`[data-id="${character.id}"]`);
            if (!entryElement) {
                this.createCharacterEntryViaDOM(character, content);
                return;
            }
            
            const contentElement = entryElement.querySelector('.entry_content');
            if (contentElement) {
                contentElement.textContent = content;
            }
            
            const metadataElement = entryElement.querySelector('.entry_metadata');
            if (metadataElement) {
                metadataElement.textContent = JSON.stringify({
                    importance: character.importance,
                    worldSetting: character.worldSetting,
                    aiGenerated: character.aiGenerated || false,
                    lastUpdated: character.lastUpdated
                });
            }
            
            this.triggerWorldBookUpdate();
            console.log(`✅ 世界书条目更新成功: ${character.name}`);
        } catch (error) {
            console.error('通过 DOM 更新人物条目失败:', error);
        }
    }

    async deleteCharacterEntry(characterId) {
        try {
            if (window.worldbook && window.worldbook.deleteEntry) {
                await window.worldbook.deleteEntry(characterId);
                return;
            }
            
            this.deleteCharacterEntryViaDOM(characterId);
        } catch (error) {
            console.error('删除人物条目失败:', error);
        }
    }

    deleteCharacterEntryViaDOM(characterId) {
        try {
            const entryElement = document.querySelector(`[data-id="${characterId}"]`);
            if (entryElement) {
                entryElement.remove();
                this.triggerWorldBookUpdate();
                console.log(`✅ 世界书条目删除成功: ${characterId}`);
            }
        } catch (error) {
            console.error('通过 DOM 删除人物条目失败:', error);
        }
    }

    createEntryElement(entryData) {
        const entry = document.createElement('div');
        entry.className = 'world_book_entry';
        entry.dataset.id = entryData.id;
        
        entry.innerHTML = `
            <div class="entry_header">
                <div class="entry_name">${entryData.name}</div>
                <div class="entry_keys">
                    ${entryData.keys.map(key => `<span class="entry_key">${key}</span>`).join('')}
                </div>
            </div>
            <div class="entry_content">${entryData.content}</div>
            ${entryData.metadata ? `
                <div class="entry_metadata" style="display: none;">${JSON.stringify(entryData.metadata)}</div>
            ` : ''}
        `;
        
        return entry;
    }

    formatCharacterForWorldBook(character) {
        let content = `【人物设定】${character.name}\n\n`;
        
        // 基本信息
        content += `**基本信息**\n`;
        content += `- 姓名：${character.basicInfo.name}\n`;
        content += `- 性别：${character.basicInfo.gender}\n`;
        content += `- 年龄：${character.basicInfo.age}\n`;
        content += `- 职业：${character.basicInfo.occupation}\n`;
        content += `- 位置：${character.basicInfo.location}\n`;
        content += `- 重要性：${importanceLevels[character.importance].name}\n\n`;
        
        // 外貌描述
        if (character.detailInfo.appearance) {
            content += `**外貌描述**\n`;
            content += `${character.detailInfo.appearance}\n\n`;
        }
        
        // 性格特征
        content += `**性格特征**\n`;
        content += `${character.detailInfo.personality}\n\n`;
        
        // 背景故事
        content += `**背景故事**\n`;
        content += `${character.detailInfo.background}\n\n`;
        
        // 技能特长
        if (character.detailInfo.skills) {
            content += `**技能特长**\n`;
            content += `${character.detailInfo.skills}\n\n`;
        }
        
        // 人际关系
        if (character.detailInfo.relationships) {
            content += `**人际关系**\n`;
            content += `${character.detailInfo.relationships}\n\n`;
        }
        
        // 动机目标
        if (character.detailInfo.motivation) {
            content += `**动机目标**\n`;
            content += `${character.detailInfo.motivation}\n\n`;
        }
        
        // 关系网络信息
        if (context.extensionSettings[settingsKey].enableRelationshipNetwork) {
            const relationshipAnalysis = relationshipNetworkManager.getNetworkAnalysis(character.id);
            if (relationshipAnalysis.totalConnections > 0) {
                content += `**关系网络**\n`;
                content += `- 关系总数：${relationshipAnalysis.totalConnections}\n`;
                content += `- 平均关系强度：${(relationshipAnalysis.averageStrength * 100).toFixed(1)}%\n`;
                
                if (relationshipAnalysis.strongestRelationships.length > 0) {
                    content += `- 主要关系：`;
                    relationshipAnalysis.strongestRelationships.slice(0, 3).forEach(rel => {
                        const targetChar = characterDatabase.getCharacter(rel.toCharacterId);
                        const targetName = targetChar ? targetChar.name : '未知';
                        content += `${targetName}(${rel.type}) `;
                    });
                    content += `\n`;
                }
                content += `\n`;
            }
        }
        
        // 时间线信息
        if (context.extensionSettings[settingsKey].enableTimelineManagement) {
            const timelineAnalysis = timelineManager.getTimelineAnalysis(character.id);
            if (timelineAnalysis.totalEvents > 0) {
                content += `**时间线概要**\n`;
                content += `- 总事件数：${timelineAnalysis.totalEvents}\n`;
                content += `- 高重要性事件：${timelineAnalysis.importanceDistribution.high}个\n`;
                
                if (timelineAnalysis.keyEvents.length > 0) {
                    content += `- 关键事件：`;
                    timelineAnalysis.keyEvents.slice(0, 3).forEach(event => {
                        content += `${event.title} `;
                    });
                    content += `\n`;
                }
                content += `\n`;
            }
        }
        
        // 元数据
        content += `**元数据**\n`;
        content += `- 创建时间：${new Date(character.createdAt).toLocaleString()}\n`;
        content += `- 最后更新：${new Date(character.lastUpdated).toLocaleString()}\n`;
        content += `- 交互次数：${character.interactionCount}\n`;
        if (character.aiGenerated) {
            content += `- AI生成：是\n`;
        }
        
        return content;
    }

    triggerWorldBookUpdate() {
        try {
            $(document).trigger('worldbook_updated', [{
                source: 'LayeredCharacterWorldbookSystem',
                timestamp: Date.now()
            }]);
            
            if (window.worldbook && window.worldbook.refresh) {
                window.worldbook.refresh();
            }
            
            this.worldBookCache = null;
            this.cacheExpiry = 0;
        } catch (error) {
            console.error('触发世界书更新事件失败:', error);
        }
    }

    async loadExistingCharacters() {
        try {
            const worldBook = await this.getCurrentWorldBook();
            const loadedCharacters = [];
            
            worldBook.entries.forEach(entry => {
                if (entry.id && entry.id.startsWith('CHAR_')) {
                    const character = this.parseCharacterFromEntry(entry);
                    if (character) {
                        loadedCharacters.push(character);
                    }
                }
            });
            
            console.log(`从世界书加载了 ${loadedCharacters.length} 个人物`);
            return loadedCharacters;
        } catch (error) {
            console.error('从世界书加载人物失败:', error);
            return [];
        }
    }

    parseCharacterFromEntry(entry) {
        try {
            const character = {
                id: entry.id,
                name: '',
                importance: 'background',
                basicInfo: {},
                detailInfo: {},
                keys: entry.keys || [],
                lastUpdated: new Date().toISOString()
            };
            
            const lines = entry.content.split('\n');
            let currentSection = '';
            
            lines.forEach(line => {
                line = line.trim();
                
                if (line.startsWith('**基本信息**')) {
                    currentSection = 'basic';
                } else if (line.startsWith('**外貌描述**')) {
                    currentSection = 'appearance';
                } else if (line.startsWith('**性格特征**')) {
                    currentSection = 'personality';
                } else if (line.startsWith('**背景故事**')) {
                    currentSection = 'background';
                } else if (line.startsWith('**技能特长**')) {
                    currentSection = 'skills';
                } else if (line.startsWith('**人际关系**')) {
                    currentSection = 'relationships';
                } else if (line.startsWith('**动机目标**')) {
                    currentSection = 'motivation';
                } else if (line.startsWith('- 姓名：')) {
                    character.name = line.split('姓名：')[1]?.trim();
                    character.basicInfo.name = character.name;
                } else if (line.startsWith('- 性别：')) {
                    character.basicInfo.gender = line.split('性别：')[1]?.trim();
                } else if (line.startsWith('- 年龄：')) {
                    character.basicInfo.age = parseInt(line.split('年龄：')[1]?.trim());
                } else if (line.startsWith('- 职业：')) {
                    character.basicInfo.occupation = line.split('职业：')[1]?.trim();
                } else if (line.startsWith('- 位置：')) {
                    character.basicInfo.location = line.split('位置：')[1]?.trim();
                } else if (line.startsWith('- 重要性：')) {
                    const importance = line.split('重要性：')[1]?.trim();
                    if (importance.includes('主要')) character.importance = 'main';
                    else if (importance.includes('次要')) character.importance = 'secondary';
                } else if (currentSection && line.startsWith('- ')) {
                    const content = line.substring(2);
                    switch (currentSection) {
                        case 'appearance':
                            character.detailInfo.appearance = content;
                            break;
                        case 'personality':
                            character.detailInfo.personality = content;
                            break;
                        case 'background':
                            character.detailInfo.background = content;
                            break;
                        case 'skills':
                            character.detailInfo.skills = content;
                            break;
                        case 'relationships':
                            character.detailInfo.relationships = content;
                            break;
                        case 'motivation':
                            character.detailInfo.motivation = content;
                            break;
                    }
                }
            });
            
            if (entry.metadata) {
                character.worldSetting = entry.metadata.worldSetting;
                character.aiGenerated = entry.metadata.aiGenerated;
                character.createdAt = entry.metadata.createdAt;
                character.importance = entry.metadata.importance || character.importance;
            }
            
            if (character.name) {
                return character;
            }
        } catch (error) {
            console.error('解析人物条目失败:', error);
        }
        
        return null;
    }
}

// 上下文管理器
class ContextManager {
    constructor() {
        this.contextCache = null;
        this.cacheExpiry = 0;
    }
    
    async getCurrentContext() {
        if (this.contextCache && Date.now() < this.cacheExpiry) {
            return this.contextCache;
        }
        
        try {
            const context = await this.getContextFromSillyTavern();
            
            this.contextCache = context;
            this.cacheExpiry = Date.now() + 5000;
            
            return context;
        } catch (error) {
            console.error('获取上下文失败:', error);
            return this.getFallbackContext();
        }
    }
    
    async getContextFromSillyTavern() {
        const context = {
            messages: [],
            characters: [],
            worldInfo: '',
            systemPrompt: '',
            chatMetadata: {},
            relationshipContext: '',
            timelineContext: ''
        };
        
        if (window.chat && window.chat.length) {
            context.messages = window.chat.map(msg => ({
                role: msg.is_user ? 'user' : 'assistant',
                content: msg.mes,
                timestamp: msg.send_date
            }));
        }
        
        if (window.characters && window.characters.length) {
            context.characters = window.characters.map(char => ({
                name: char.name,
                description: char.description,
                personality: char.personality
            }));
        }
        
        if (window.worldInfo && window.worldInfo.trim()) {
            context.worldInfo = window.worldInfo;
        }
        
        if (window.systemPrompt && window.systemPrompt.trim()) {
            context.systemPrompt = window.systemPrompt;
        }
        
        if (window.chat_metadata) {
            context.chat_metadata = window.chat_metadata;
        }
        
        // 添加关系网络和时间线上下文
        if (context.extensionSettings[settingsKey].enableRelationshipNetwork) {
            context.relationshipContext = await this.getRelationshipContext();
        }
        
        if (context.extensionSettings[settingsKey].enableTimelineManagement) {
            context.timelineContext = await this.getTimelineContext();
        }
        
        return context;
    }
    
    async getRelationshipContext() {
        // 获取当前对话中涉及的人物关系
        const mentionedCharacters = this.getMentionedCharacters();
        let relationshipContext = '';
        
        for (const characterId of mentionedCharacters) {
            const character = characterDatabase.getCharacter(characterId);
            if (character) {
                const relationshipText = relationshipNetworkManager.generateNetworkTextForAI(characterId, {});
                relationshipContext += relationshipText + '\n\n';
            }
        }
        
        return relationshipContext.trim();
    }
    
    async getTimelineContext() {
        // 获取当前对话中涉及的人物时间线
        const mentionedCharacters = this.getMentionedCharacters();
        let timelineContext = '';
        
        for (const characterId of mentionedCharacters) {
            const character = characterDatabase.getCharacter(characterId);
            if (character) {
                const timelineText = timelineManager.generateTimelineTextForAI(characterId, {});
                timelineContext += timelineText + '\n\n';
            }
        }
        
        return timelineContext.trim();
    }
    
    getMentionedCharacters() {
        // 从当前消息中提取提到的人物
        const mentionedCharacters = new Set();
        
        // 这里应该从当前对话上下文中提取提到的人物
        // 简化实现，返回所有活跃人物
        characterDatabase.getRecentCharacters(5).forEach(char => {
            mentionedCharacters.add(char.id);
        });
        
        return Array.from(mentionedCharacters);
    }
    
    getFallbackContext() {
        return {
            messages: [],
            characters: [],
            worldInfo: '',
            systemPrompt: '',
            chatMetadata: {},
            relationshipContext: '',
            timelineContext: ''
        };
    }
    
    async getFormattedContextForAI() {
        const context = await this.getCurrentContext();
        
        let formattedContext = '';
        
        if (context.systemPrompt) {
            formattedContext += `系统提示：${context.systemPrompt}\n\n`;
        }
        
        if (context.worldInfo) {
            formattedContext += `世界设定：${context.worldInfo}\n\n`;
        }
        
        if (context.characters.length > 0) {
            formattedContext += '现有角色：\n';
            context.characters.forEach(char => {
                formattedContext += `- ${char.name}：${char.description}\n`;
            });
            formattedContext += '\n';
        }
        
        // 添加关系网络上下文
        if (context.relationshipContext) {
            formattedContext += '人物关系网络：\n';
            formattedContext += context.relationshipContext + '\n\n';
        }
        
        // 添加时间线上下文
        if (context.timelineContext) {
            formattedContext += '人物时间线：\n';
            formattedContext += context.timelineContext + '\n\n';
        }
        
        if (context.messages.length > 0) {
            formattedContext += '对话历史：\n';
            context.messages.forEach(msg => {
                formattedContext += `${msg.role === 'user' ? '用户' : '助手'}：${msg.content}\n`;
            });
        }
        
        return formattedContext;
    }
}

// 世界设定检测器（简化版）
class WorldSettingDetector {
    constructor() {
        this.worldSettings = new Map();
        this.initializeDefaultSettings();
    }

    initializeDefaultSettings() {
        this.worldSettings.set('default', {
            name: '默认世界',
            keywords: ['村庄', '城市', '冒险', '魔法'],
            allowedOccupations: ['铁匠', '药师', '商人', '守卫', '学者'],
            allowedBackgrounds: ['本地居民', '外来者', '流浪者'],
            forbiddenElements: ['现代科技', '未来科技']
        });

        this.worldSettings.set('fantasy', {
            name: '奇幻世界',
            keywords: ['魔法', '龙', '精灵', '矮人', '骑士'],
            allowedOccupations: ['法师', '战士', '牧师', '盗贼', '吟游诗人'],
            allowedBackgrounds: ['贵族', '平民', '流浪者', '学徒'],
            forbiddenElements: ['现代科技', '枪械']
        });

        this.worldSettings.set('modern', {
            name: '现代世界',
            keywords: ['城市', '公司', '学校', '科技'],
            allowedOccupations: ['程序员', '医生', '律师', '教师', '商人'],
            allowedBackgrounds: ['城市居民', '留学生', '移民'],
            forbiddenElements: ['魔法', '超能力']
        });
    }

    detectWorldSetting(context) {
        const message = context.message || '';
        const worldInfo = context.worldInfo || '';
        const fullText = (message + ' ' + worldInfo).toLowerCase();

        let bestMatch = 'default';
        let maxScore = 0;

        this.worldSettings.forEach((setting, key) => {
            let score = 0;
            setting.keywords.forEach(keyword => {
                if (fullText.includes(keyword.toLowerCase())) {
                    score++;
                }
            });

            if (score > maxScore) {
                maxScore = score;
                bestMatch = key;
            }
        });

        return {
            setting: bestMatch,
            details: this.worldSettings.get(bestMatch)
        };
    }

    validateCharacterForWorld(character, worldDetails) {
        const issues = [];
        
        // 检查职业
        if (character.basicInfo.occupation && 
            !worldDetails.allowedOccupations.some(allowed => 
                character.basicInfo.occupation.includes(allowed) || 
                allowed.includes(character.basicInfo.occupation))) {
            issues.push(`职业 "${character.basicInfo.occupation}" 不符合世界设定`);
        }
        
        // 检查背景
        if (character.detailInfo.background && 
            worldDetails.forbiddenElements.some(forbidden => 
                character.detailInfo.background.includes(forbidden))) {
            issues.push(`背景包含禁止元素`);
        }
        
        return {
            valid: issues.length === 0,
            issues
        };
    }
}

// 复杂性格引擎（简化版）
class ComplexPersonalityEngine {
    constructor() {
        this.personalityTraits = {
            core: ['勇敢', '谨慎', '乐观', '悲观', '理性', '感性', '外向', '内向'],
            social: ['友善', '冷漠', '健谈', '沉默', '领导力', '服从', '合作', '竞争'],
            emotional: ['稳定', '易怒', '敏感', '迟钝', '热情', '冷漠', '幽默', '严肃'],
            moral: ['正直', '狡猾', '无私', '自私', '宽容', '苛刻', '忠诚', '背叛']
        };
    }

    generateComplexCharacter(character) {
        const corePersonality = this.selectBalancedTraits(this.personalityTraits.core, 2);
        const socialTraits = this.selectBalancedTraits(this.personalityTraits.social, 2);
        const emotionalTraits = this.selectBalancedTraits(this.personalityTraits.emotional, 2);
        const moralTraits = this.selectBalancedTraits(this.personalityTraits.moral, 2);

        return {
            corePersonality: corePersonality.join('、'),
            socialTraits: socialTraits.join('、'),
            emotionalTraits: emotionalTraits.join('、'),
            moralTraits: moralTraits.join('、'),
            conflicts: this.generatePersonalityConflicts(corePersonality, socialTraits, emotionalTraits, moralTraits),
            growthPotential: this.calculateGrowthPotential(character)
        };
    }

    selectBalancedTraits(traitArray, count) {
        const selected = [];
        const available = [...traitArray];
        
        for (let i = 0; i < count && available.length > 0; i++) {
            const index = Math.floor(Math.random() * available.length);
            selected.push(available[index]);
            available.splice(index, 1);
        }
        
        return selected;
    }

    generatePersonalityConflicts(core, social, emotional, moral) {
        const conflicts = [];
        
        // 检查核心与社交的冲突
        if (core.includes('内向') && social.includes('健谈')) {
            conflicts.push('内心渴望独处却又需要社交');
        }
        
        // 检查情感与道德的冲突
        if (emotional.includes('易怒') && moral.includes('正直')) {
            conflicts.push('情绪易激动但坚守道德底线');
        }
        
        return conflicts;
    }

    calculateGrowthPotential(character) {
        // 基于人物复杂度计算成长潜力
        const complexityScore = 
            (character.detailInfo.personality?.length || 0) * 0.1 +
            (character.detailInfo.background?.length || 0) * 0.05 +
            (character.detailInfo.skills?.length || 0) * 0.05;
        
        return Math.min(1.0, complexityScore / 10);
    }

    generatePersonalityDescription(complexPersonality) {
        let description = `${complexPersonality.corePersonality}的性格`;
        
        if (complexPersonality.socialTraits) {
            description += `，在社交方面${complexPersonality.socialTraits}`;
        }
        
        if (complexPersonality.emotionalTraits) {
            description += `，情感表现${complexPersonality.emotionalTraits}`;
        }
        
        if (complexPersonality.moralTraits) {
            description += `，道德观念${complexPersonality.moralTraits}`;
        }
        
        if (complexPersonality.conflicts && complexPersonality.conflicts.length > 0) {
            description += `。内心存在冲突：${complexPersonality.conflicts.join('、')}`;
        }
        
        return description;
    }

    validateComplexPersonalityConsistency(character) {
        const issues = [];
        
        // 检查性格一致性
        if (character.detailInfo.complexPersonality) {
            const personality = character.detailInfo.complexPersonality;
            
            // 检查冲突是否过多
            if (personality.conflicts && personality.conflicts.length > 3) {
                issues.push('性格冲突过多，可能影响人物一致性');
            }
            
            // 检查成长潜力是否合理
            if (personality.growthPotential > 0.9) {
                issues.push('成长潜力过高，可能需要更多背景支撑');
            }
        }
        
        return {
            valid: issues.length === 0,
            issues
        };
    }
}

// UI管理器
class UIManager {
    constructor() {
        this.statsContainer = null;
        this.charactersList = null;
    }

    createUI() {
        // UI已由FloatingBallUI处理
    }

    updateStats() {
        if (floatingBallUI && floatingBallUI.isVisible) {
            floatingBallUI.updateContent();
        }
    }

    updateCharacterGrowthUI(characterId) {
        // 更新人物成长UI
        console.log(`更新人物成长UI: ${characterId}`);
    }

    showMilestoneNotification(characterId, milestones) {
        const character = characterDatabase.getCharacter(characterId);
        if (!character) return;
        
        let message = `${character.name} 达成新里程碑！\n`;
        milestones.forEach(milestone => {
            message += `- ${milestone.description}\n`;
        });
        
        showNotification(message, 'success');
    }
}

// 智能触发系统（简化版）
class SmartTriggerSystem {
    constructor() {
        this.lastTriggerTime = 0;
        this.triggerCooldown = 5 * 60 * 1000; // 5分钟冷却
    }

    checkTrigger(context) {
        const now = Date.now();
        if (now - this.lastTriggerTime < this.triggerCooldown) {
            return false;
        }

        const message = context.message || '';
        const shouldTrigger = shouldGenerateCharacter(message);
        
        if (shouldTrigger) {
            this.lastTriggerTime = now;
        }
        
        return shouldTrigger;
    }
}

// 人物重要性管理器（简化版）
class CharacterImportanceManager {
    constructor() {
        this.upgradeThresholds = {
            main: 25,
            secondary: 10,
            background: 0
        };
    }

    checkImportanceUpgrade(characterId) {
        const character = characterDatabase.getCharacter(characterId);
        if (!character) return;

        const currentImportance = character.importance;
        const interactionCount = character.interactionCount || 0;
        
        let newImportance = currentImportance;
        
        if (currentImportance === 'background' && interactionCount >= this.upgradeThresholds.secondary) {
            newImportance = 'secondary';
        } else if (currentImportance === 'secondary' && interactionCount >= this.upgradeThresholds.main) {
            newImportance = 'main';
        }
        
        if (newImportance !== currentImportance) {
            this.upgradeCharacterImportance(character, newImportance);
        }
    }

    async upgradeCharacterImportance(character, newImportance) {
        character.importance = newImportance;
        character.lastUpdated = new Date().toISOString();
        
        // 更新数据库索引
        characterDatabase.importanceIndex.set(newImportance, 
            (characterDatabase.importanceIndex.get(newImportance) || []).concat(character.id)
        );
        characterDatabase.importanceIndex.set(character.importance, 
            (characterDatabase.importanceIndex.get(character.importance) || []).filter(id => id !== character.id)
        );
        
        // 更新世界书
        await worldBookManager.updateCharacterEntry(character);
        await worldBookManager.updateIndexEntry();
        
        showNotification(`${character.name} 已升级为${importanceLevels[newImportance].name}`, 'success');
        
        console.log('人物重要性升级:', {
            characterId: character.id,
            name: character.name,
            oldImportance: character.importance,
            newImportance: newImportance
        });
    }
}

// 人物成长系统（简化版）
class CharacterGrowthSystem {
    constructor() {
        this.growthTypes = {
            combat: '战斗能力',
            social: '社交能力',
            knowledge: '知识水平',
            craft: '工艺技能',
            magic: '魔法能力'
        };
        
        this.growthEvents = [];
    }

    initializeCharacterGrowth(character) {
        const growthData = {};
        
        Object.keys(this.growthTypes).forEach(area => {
            growthData[area] = {
                level: 1.0,
                experience: 0,
                milestones: [],
                lastGrowth: Date.now()
            };
        });
        
        return growthData;
    }

    async processGrowthEvent(character, event) {
        if (!character.growthData) {
            character.growthData = this.initializeCharacterGrowth(character);
        }
        
        const growthAreas = this.determineGrowthAreas(event);
        const changes = [];
        let growthOccurred = false;
        
        for (const area of growthAreas) {
            if (!character.growthData[area]) continue;
            
            const oldLevel = character.growthData[area].level;
            const experienceGain = event.intensity * 10;
            
            character.growthData[area].experience += experienceGain;
            
            // 计算新等级
            const newLevel = this.calculateNewLevel(
                character.growthData[area].level,
                character.growthData[area].experience
            );
            
            if (newLevel > oldLevel) {
                character.growthData[area].level = newLevel;
                character.growthData[area].lastGrowth = Date.now();
                
                changes.push({
                    area,
                    oldLevel,
                    newLevel,
                    growthType: this.determineGrowthType(oldLevel, newLevel)
                });
                
                growthOccurred = true;
                
                // 检查里程碑
                this.checkMilestones(character, area, newLevel);
            }
        }
        
        return {
            growthOccurred,
            changes
        };
    }

    determineGrowthAreas(event) {
        const areas = [];
        
        switch (event.type) {
            case 'combat':
            case 'conflict':
                areas.push('combat');
                break;
            case 'relationship':
            case 'social':
                areas.push('social');
                break;
            case 'learning':
            case 'discovery':
                areas.push('knowledge');
                break;
            case 'craft':
            case 'achievement':
                areas.push('craft');
                break;
            case 'magic':
                areas.push('magic');
                break;
            default:
                // 默认根据事件描述判断
                if (event.description.includes('战斗') || event.description.includes('冲突')) {
                    areas.push('combat');
                }
                if (event.description.includes('社交') || event.description.includes('朋友')) {
                    areas.push('social');
                }
                if (event.description.includes('学习') || event.description.includes('知识')) {
                    areas.push('knowledge');
                }
                if (event.description.includes('工艺') || event.description.includes('制作')) {
                    areas.push('craft');
                }
                if (event.description.includes('魔法') || event.description.includes('法术')) {
                    areas.push('magic');
                }
        }
        
        return areas.length > 0 ? areas : ['social']; // 默认社交成长
    }

    calculateNewLevel(currentLevel, experience) {
        // 简单的等级计算公式
        const requiredExp = currentLevel * currentLevel * 100;
        if (experience >= requiredExp) {
            return currentLevel + 0.1;
        }
        return currentLevel;
    }

    determineGrowthType(oldLevel, newLevel) {
        const growth = newLevel - oldLevel;
        
        if (growth > 0.5) return 'breakthrough';
        if (growth > 0.2) return 'gradual';
        if (growth > 0) return 'stable';
        return 'temporary_setback';
    }

    checkMilestones(character, area, level) {
        const milestones = [
            { level: 2, description: `${this.growthTypes[area]}初窥门径` },
            { level: 5, description: `${this.growthTypes[area]}小有成就` },
            { level: 10, description: `${this.growthTypes[area]}技艺精湛` },
            { level: 15, description: `${this.growthTypes[area]}大师级别` }
        ];
        
        milestones.forEach(milestone => {
            if (Math.floor(level) === milestone.level && 
                !character.growthData[area].milestones.includes(milestone.description)) {
                
                character.growthData[area].milestones.push(milestone.description);
                
                $(document).trigger('character_milestones_achieved', [character.id, [milestone]]);
            }
        });
    }

    getGrowthReport(character) {
        if (!character.growthData) {
            return {
                summary: '该人物暂无成长数据',
                areas: {},
                milestones: []
            };
        }
        
        const areas = {};
        let totalLevel = 0;
        let areaCount = 0;
        
        Object.keys(character.growthData).forEach(area => {
            if (this.growthTypes[area]) {
                areas[area] = {
                    name: this.growthTypes[area],
                    level: character.growthData[area].level,
                    experience: character.growthData[area].experience
                };
                totalLevel += character.growthData[area].level;
                areaCount++;
            }
        });
        
        const averageLevel = areaCount > 0 ? totalLevel / areaCount : 0;
        
        return {
            summary: `总体成长等级: ${averageLevel.toFixed(1)}级`,
            areas,
            milestones: this.getAllMilestones(character)
        };
    }

    getAllMilestones(character) {
        const milestones = [];
        
        if (character.growthData) {
            Object.keys(character.growthData).forEach(area => {
                if (character.growthData[area].milestones) {
                    character.growthData[area].milestones.forEach(milestone => {
                        milestones.push({
                            area: this.growthTypes[area] || area,
                            description: milestone
                        });
                    });
                }
            });
        }
        
        return milestones;
    }
}

// 更新现有的全局实例
const worldBookManager = new WorldBookManager();
const contextManager = new ContextManager();
const smartTriggerSystem = new SmartTriggerSystem();
const importanceManager = new CharacterImportanceManager();
const growthSystem = new CharacterGrowthSystem();
const worldSettingDetector = new WorldSettingDetector();
const complexPersonalityEngine = new ComplexPersonalityEngine();
const uiManager = new UIManager();

// 初始化错误恢复策略
function setupErrorRecoveryStrategies() {
    // AI超时重试策略
    errorRecoveryManager.registerRetryStrategy('AI_TIMEOUT', async (error, context) => {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒
        context.retryCount = (context.retryCount || 0) + 1;
        return await context.retryFunction();
    });
    
    // AI超时回退到本地生成
    errorRecoveryManager.registerFallbackMethod('AI_TIMEOUT', async (error, context) => {
        console.log('🔄 AI超时，回退到本地生成');
        return await context.fallbackFunction();
    });
    
    // 世界书同步重试策略
    errorRecoveryManager.registerRetryStrategy('WORLDBOOK_SYNC', async (error, context) => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        context.retryCount = (context.retryCount || 0) + 1;
        return await context.retryFunction();
    });
    
    // 验证失败回退策略
    errorRecoveryManager.registerFallbackMethod('VALIDATION_FAILED', async (error, context) => {
        console.log('🔄 验证失败，使用简化数据');
        return await context.fallbackFunction();
    });
}

// 工具函数
function generateCharacterId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `CHAR_${timestamp}_${random}`.toUpperCase();
}

function getRandomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function getRandomItems(array, min, max) {
    const count = Math.floor(Math.random() * (max - min + 1)) + min;
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

function extractLocation(message) {
    const locations = ['酒馆', '市场', '铁匠铺', '药店', '城门', '旅店', '商店', '街道'];
    return locations.find(location => message.includes(location));
}

function generateAppearance(importance) {
    if (importance === 'main') {
        const features = ["身材高大魁梧", "中等身材", "身材瘦削", "体型丰满", "面容俊美", "相貌平平", "饱经风霜", "年轻有活力"];
        const styles = ["留着长发", "短发利落", "光头", "扎着辫子", "有胡须", "面容干净", "有疤痕", "有纹身"];
        const clothing = ["穿着华丽的服装", "衣着朴素", "穿着工作服", "穿着盔甲", "穿着长袍", "穿着便装", "穿着制服", "穿着奇装异服"];
        return `${getRandomItem(features)}，${getRandomItem(styles)}，${getRandomItem(clothing)}`;
    } else if (importance === 'secondary') {
        const appearances = ["高个子", "矮个子", "身材魁梧", "身材瘦削", "面容俊美", "相貌平平", "留着长发", "短发利落"];
        return getRandomItems(appearances, 2, 3).join('、');
    } else {
        const simple = ["普通", "友善", "忙碌", "沉默"];
        return getRandomItem(simple);
    }
}

function generateSkills(importance) {
    if (importance === 'main') {
        const skills = [
            "武器锻造：精通", "盔甲制作：熟练", "金属鉴定：专家",
            "商业谈判：精通", "商品鉴定：熟练", "市场信息：丰富",
            "医疗技术：精通", "草药学：熟练", "诊断：专家"
        ];
        return getRandomItems(skills, 3, 5).join('，');
    } else if (importance === 'secondary') {
        const skills = ["专业技能", "社交能力", "战斗技巧", "知识水平", "手工艺"];
        return `${getRandomItem(skills)}：熟练`;
    } else {
        const skills = ["基础技能", "普通能力", "日常工作"];
        return getRandomItem(skills);
    }
}

function generateRelationships(importance) {
    if (importance === 'main') {
        const relationships = [
            "与王铁匠：商业伙伴，互相信任",
            "与李商人：竞争对手，关系紧张",
            "与赵药师：好友，经常合作",
            "与张守卫：上下级，相互尊重"
        ];
        return getRandomItems(relationships, 2, 4).join('；');
    } else if (importance === 'secondary') {
        const relationships = ["友好", "中立", "警惕", "竞争"];
        return getRandomItem(relationships);
    } else {
        return "";
    }
}

function getCharacterCountByImportance(importance) {
    let count = 0;
    characterDatabase.characters.forEach(character => {
        if (character.importance === importance) {
            count++;
        }
    });
    return count;
}

function updateCharacterIndex(character) {
    const indexEntry = {
        id: character.id,
        name: character.name,
        occupation: character.basicInfo.occupation,
        importance: character.importance,
        status: 'active',
        lastSeen: character.basicInfo.location,
        lastUpdated: character.lastUpdated
    };
    
    const existingIndex = characterIndex.findIndex(item => item.id === character.id);
    if (existingIndex >= 0) {
        characterIndex[existingIndex] = indexEntry;
    } else {
        characterIndex.push(indexEntry);
    }
}

function generateIndexContent() {
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
    
    characterIndex.forEach(character => {
        content += `[${character.id}] ${character.name} | ${character.occupation} | ${importanceEmoji[character.importance]}${importanceLevels[character.importance].name} | ${character.status} | ${character.lastSeen}\n`;
    });
    
    const stats = getCharacterStats();
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

function getCharacterStats() {
    const stats = {
        total: characterDatabase.characters.size,
        main: 0,
        secondary: 0,
        background: 0
    };
    
    characterDatabase.characters.forEach(character => {
        stats[character.importance]++;
    });
    
    return stats;
}

function isCharacterLimitReached() {
    const stats = getCharacterStats();
    return stats.total >= (context.extensionSettings[settingsKey].maxMainCharacters + 
                          context.extensionSettings[settingsKey].maxSecondaryCharacters + 
                          context.extensionSettings[settingsKey].maxBackgroundCharacters);
}

function showNotification(message, type = 'info') {
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

function shouldGenerateCharacter(message) {
    return triggerKeywords.generate.some(keyword => 
        message.toLowerCase().includes(keyword.toLowerCase())
    );
}

function shouldShowIndex(message) {
    return triggerKeywords.index.some(keyword => 
        message.toLowerCase().includes(keyword.toLowerCase())
    );
}

function shouldHandleRelationship(message) {
    return triggerKeywords.relationship.some(keyword => 
        message.toLowerCase().includes(keyword.toLowerCase())
    );
}

function shouldHandleTimeline(message) {
    return triggerKeywords.timeline.some(keyword => 
        message.toLowerCase().includes(keyword.toLowerCase())
    );
}

// AI生成功能
async function generateCharacterWithAI(message, context) {
    console.log('🤖 开始使用AI生成人物...');
    
    const operation = performanceMonitor.startOperation('ai');
    
    try {
        const worldSetting = worldSettingDetector.detectWorldSetting(context);
        console.log('世界设定检测结果:', worldSetting);
        
        const importance = determineCharacterImportance(message, context);
        
        const prompt = await generateCharacterPrompt(message, context, worldSetting, importance);
        
        const aiResponse = await callSillyTavernAI(prompt);
        const character = parseAIResponse(aiResponse, importance, worldSetting);
        
        await validateAndEnhanceCharacter(character, worldSetting);
        
        // 创建初始关系和时间线
        if (context.extensionSettings[settingsKey].enableRelationshipNetwork) {
            await createInitialRelationships(character);
        }
        
        if (context.extensionSettings[settingsKey].enableTimelineManagement) {
            await createInitialTimeline(character);
        }
        
        operation.end();
        performanceMonitor.metrics.aiCalls++;
        
        console.log('✅ AI人物生成完成:', character.name);
        return character;
    } catch (error) {
        operation.end();
        performanceMonitor.recordError('ai');
        
        console.error('❌ AI人物生成失败:', error);
        
        // 使用错误恢复机制
        return await errorRecoveryManager.handleError(
            new CharacterSystemError('AI_TIMEOUT', 'AI生成失败', { originalError: error }),
            {
                retryFunction: () => generateCharacterWithAI(message, context),
                fallbackFunction: () => generateCharacterLocally(message, context, worldSettingDetector.detectWorldSetting(context), determineCharacterImportance(message, context)),
                retryCount: 0,
                maxRetries: context.extensionSettings[settingsKey].maxRetryAttempts
            }
        );
    }
}

async function generateCharacterPrompt(message, context, worldSetting, importance) {
    const fullContext = await contextManager.getFormattedContextForAI();
    
    const importanceNames = {
        main: '主要人物',
        secondary: '次要人物',
        background: '背景人物'
    };
    
    const importanceDescriptions = {
        main: '这是一个故事中的关键角色，需要详细的背景、性格和成长潜力',
        secondary: '这是一个重要的配角，需要基本的背景和性格特征',
        background: '这是一个背景角色，只需要简单的基本信息'
    };
    
    const prompt = `请根据以下信息生成一个符合${worldSetting.details.name}设定的角色：
**当前上下文**：
${fullContext}
**触发情境**: "${message}"
**世界设定**: ${worldSetting.details.name}
**关键词**: ${worldSetting.details.keywords.join(', ')}
**允许职业**: ${worldSetting.details.allowedOccupations.join(', ')}
**允许背景**: ${worldSetting.details.allowedBackgrounds.join(', ')}
**角色重要性**: ${importanceNames[importance]}
**详细要求**: ${importanceDescriptions[importance]}
**生成要求**:
1. 角色必须符合世界设定，不能包含禁忌元素：${worldSetting.details.forbiddenElements.join(', ')}
2. 请生成一个真实、立体、有深度的角色
3. 考虑当前对话的上下文和已有角色
4. 确保新角色与现有角色和情节协调一致
5. 包含姓名、性别、年龄、职业、外貌、性格、背景故事等基本信息
6. 根据重要性级别提供相应详细程度的描述
7. 确保角色具有独特的个性和合理的动机
8. 考虑角色在触发情境中的合理性和存在意义
**输出格式**:
请严格按照以下JSON格式输出，不要添加任何其他文字：
\`\`\`json
{
  "name": "角色姓名",
  "gender": "性别",
  "age": 年龄,
  "occupation": "职业",
  "location": "出现地点",
  "appearance": "外貌描述",
  "personality": "性格特征",
  "background": "背景故事",
  "motivation": "主要动机",
  "relationships": "人际关系",
  "skills": "技能特长",
  "secrets": "秘密或隐藏信息"
}
\`\`\``;
    
    return prompt;
}

async function callSillyTavernAI(prompt) {
    const settings = context.extensionSettings[settingsKey];
    
    switch (settings.aiApi) {
        case 'main':
            return await callMainAPI(prompt);
        case 'secondary':
            return await callSecondaryAPI(prompt);
        case 'custom':
            return await callCustomAPI(prompt);
        default:
            return await callMainAPI(prompt);
    }
}

async function callMainAPI(prompt) {
    return new Promise((resolve, reject) => {
        if (window.generate && window.generate.send) {
            const originalGenerate = window.generate.send;
            window.generate.send = async function(message) {
                try {
                    const response = await originalGenerate.call(window.generate, message);
                    window.generate.send = originalGenerate;
                    resolve(response);
                } catch (error) {
                    window.generate.send = originalGenerate;
                    reject(error);
                }
            };
            
            const input = document.createElement('textarea');
            input.value = prompt;
            input.style.display = 'none';
            document.body.appendChild(input);
            
            window.generate.send(prompt);
            
            setTimeout(() => {
                document.body.removeChild(input);
                window.generate.send = originalGenerate;
            }, 100);
        } else {
            reject(new Error('主API不可用'));
        }
    });
}

async function callSecondaryAPI(prompt) {
    return new Promise((resolve, reject) => {
        if (window.secondary_api && window.secondary_api.generate) {
            try {
                const response = window.secondary_api.generate(prompt);
                resolve(response);
            } catch (error) {
                reject(error);
            }
        } else {
            console.log('次要API不可用，回退到主API');
            return callMainAPI(prompt);
        }
    });
}

async function callCustomAPI(prompt) {
    const settings = context.extensionSettings[settingsKey];
    
    if (!settings.customApiEndpoint || !settings.customApiKey) {
        throw new Error('自定义API配置不完整');
    }
    
    try {
        const response = await fetch(settings.customApiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.customApiKey}`,
            },
            body: JSON.stringify({
                model: settings.apiModel || 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: settings.aiMaxTokens,
                temperature: settings.aiTemperature,
            })
        });
        
        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status}`);
        }
        
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error('自定义API调用失败:', error);
        throw error;
    }
}

function parseAIResponse(aiResponse, importance, worldSetting) {
    try {
        const jsonMatch = aiResponse.match(/```json\n([\s\S]*?)\n```/) || 
                          aiResponse.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) {
            throw new Error('AI响应中未找到有效的JSON格式');
        }
        
        const jsonString = jsonMatch[1] || jsonMatch[0];
        const characterData = JSON.parse(jsonString);
        
        const characterId = generateCharacterId();
        
        const character = {
            id: characterId,
            name: characterData.name,
            importance: importance,
            basicInfo: {
                name: characterData.name,
                gender: characterData.gender,
                age: characterData.age,
                occupation: characterData.occupation,
                location: characterData.location || extractLocationFromMessage(aiResponse),
                worldSetting: worldSetting.setting
            },
            detailInfo: {
                personality: characterData.personality,
                background: characterData.background,
                appearance: characterData.appearance,
                skills: characterData.skills,
                relationships: characterData.relationships,
                motivation: characterData.motivation,
                secrets: characterData.secrets
            },
            keys: [characterData.name, characterData.occupation],
            worldSetting: worldSetting.setting,
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            interactionCount: 0,
            plotRelevance: 0,
            playerRelationship: 0,
            aiGenerated: true,
            aiPrompt: await generateCharacterPrompt("", { message: "" }, worldSetting, importance),
            aiResponse: aiResponse
        };
        
        return character;
    } catch (error) {
        console.error('解析AI响应失败:', error);
        throw new CharacterSystemError('VALIDATION_FAILED', 'AI响应格式不正确', { 
            originalError: error, 
            response: aiResponse 
        });
    }
}

function extractLocationFromMessage(message) {
    const locations = ['酒馆', '市场', '铁匠铺', '药店', '城门', '旅店', '商店', '街道'];
    return locations.find(location => message.toLowerCase().includes(location.toLowerCase())) || '未知地点';
}

async function validateAndEnhanceCharacter(character, worldSetting) {
    const validation = worldSettingDetector.validateCharacterForWorld(
        { basicInfo: character.basicInfo, detailInfo: character.detailInfo }, 
        worldSetting.details
    );
    
    if (!validation.valid) {
        console.warn('人物世界设定验证失败:', validation.issues);
    }
    
    const tempCharacter = {
        basicInfo: character.basicInfo,
        detailInfo: character.detailInfo
    };
    
    const complexPersonality = complexPersonalityEngine.generateComplexCharacter(tempCharacter);
    character.detailInfo.complexPersonality = complexPersonality;
    character.detailInfo.personalityDescription = complexPersonalityEngine.generatePersonalityDescription(complexPersonality);
    
    const personalityValidation = complexPersonalityEngine.validateComplexPersonalityConsistency(character);
    character.personalityValidation = personalityValidation;
    
    if (context.extensionSettings[settingsKey].enableGrowthSystem) {
        character.growthData = growthSystem.initializeCharacterGrowth(character);
    }
    
    return character;
}

async function createInitialRelationships(character) {
    // 为新创建的人物创建一些初始关系
    const existingCharacters = characterDatabase.getRecentCharacters(5);
    
    for (const existingChar of existingCharacters) {
        if (existingChar.id === character.id) continue;
        
        // 根据职业和位置创建合理的关系
        const relationshipType = await relationshipNetworkManager.selectRelationshipType({
            fromCharacterId: character.id,
            toCharacterId: existingChar.id,
            location: character.basicInfo.location,
            occupation: character.basicInfo.occupation,
            worldSetting: character.worldSetting,
            extensionSettings: context.extensionSettings
        });
        const strength = Math.random() * 0.5 + 0.3; // 0.3-0.8之间
        
        try {
            await relationshipNetworkManager.createRelationship(
                character.id,
                existingChar.id,
                relationshipType,
                {
                    strength: strength,
                    description: `${character.name}与${existingChar.name}是${relationshipType}`,
                    bidirectional: Math.random() > 0.5
                }
            );
        } catch (error) {
            console.warn('创建初始关系失败:', error);
        }
    }
}

async function createInitialTimeline(character) {
    // 为新创建的人物创建初始时间线事件
    const events = [
        {
            type: 'birth',
            title: '出生',
            description: `${character.name}出生`,
            date: new Date(character.basicInfo.age * 365.25 * 24 * 60 * 60 * 1000),
            importance: 0.8
        },
        {
            type: 'location_change',
            title: '到达当前位置',
            description: `${character.name}到达${character.basicInfo.location}`,
            date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
            importance: 0.6
        }
    ];
    
    for (const eventData of events) {
        try {
            await timelineManager.createTimelineEvent(
                character.id,
                eventData.type,
                eventData.title,
                eventData.description,
                eventData.date,
                {
                    importance: eventData.importance,
                    location: character.basicInfo.location
                }
            );
        } catch (error) {
            console.warn('创建初始时间线事件失败:', error);
        }
    }
}

function generateCharacterLocally(message, context, worldSetting, importance) {
    console.log('🔄 使用本地生成回退方案...');
    
    const gender = Math.random() < 0.5 ? 'male' : 'female';
    const useSurname = Math.random() < 0.3;
    
    let name;
    if (useSurname) {
        const surname = getRandomItem(characterTemplates.names.surname);
        const givenName = getRandomItem(characterTemplates.names[gender]);
        name = surname + givenName;
    } else {
        name = getRandomItem(characterTemplates.names[gender]);
    }
    
    const allowedOccupations = worldSetting.details.allowedOccupations;
    const occupationTemplates = characterTemplates.occupations[importance].filter(occ => 
        allowedOccupations.some(allowed => occ.includes(allowed) || allowed.includes(occ))
    );
    
    const occupation = occupationTemplates.length > 0 ? 
        getRandomItem(occupationTemplates) : 
        getRandomItem(allowedOccupations);
    
    const character = {
        id: generateCharacterId(),
        name: name,
        importance: importance,
        basicInfo: {
            name: name,
            gender: gender === 'male' ? '男' : '女',
            age: Math.floor(Math.random() * (80 - 16 + 1)) + 16,
            occupation: occupation,
            location: extractLocation(message) || '未知地点',
            worldSetting: worldSetting.setting
        },
        detailInfo: {
            personality: getRandomItem(characterTemplates.personalities[importance]),
            background: getRandomItem(characterTemplates.backgrounds[importance]),
            appearance: generateAppearance(importance),
            skills: generateSkills(importance),
            relationships: generateRelationships(importance)
        },
        keys: [name, occupation],
        worldSetting: worldSetting.setting,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        interactionCount: 0,
        aiGenerated: false
    };
    
    return character;
}

function determineCharacterImportance(message, context) {
    let score = 0;
    if (message.includes('重要') || message.includes('关键')) score += 3;
    if (message.includes('导师') || message.includes('首领')) score += 2;
    if (message.includes('朋友') || message.includes('盟友')) score += 1;
    
    const locationKeywords = ['铁匠铺', '药店', '商会', '守卫塔'];
    if (locationKeywords.some(keyword => message.includes(keyword))) {
        score += 2;
    }
    
    const mainCount = getCharacterCountByImportance('main');
    const secondaryCount = getCharacterCountByImportance('secondary');
    
    let importance;
    if (mainCount < context.extensionSettings[settingsKey].maxMainCharacters && score >= 3) {
        importance = 'main';
    } else if (secondaryCount < context.extensionSettings[settingsKey].maxSecondaryCharacters && score >= 1) {
        importance = 'secondary';
    } else {
        importance = 'background';
    }
    
    return importance;
}

async function generateDetailInfo(importance, basicInfo) {
    const baseDetailInfo = {
        personality: getRandomItem(characterTemplates.personalities[importance]),
        background: getRandomItem(characterTemplates.backgrounds[importance]),
        appearance: generateAppearance(importance),
        skills: generateSkills(importance),
        relationships: generateRelationships(importance)
    };
    
    if (importance === 'main') {
        baseDetailInfo.story = getRandomItem(characterTemplates.backgrounds.main);
    }
    
    const tempCharacter = {
        basicInfo: basicInfo,
        detailInfo: baseDetailInfo
    };
    
    const complexPersonality = complexPersonalityEngine.generateComplexCharacter(tempCharacter);
    baseDetailInfo.complexPersonality = complexPersonality;
    baseDetailInfo.personality = complexPersonality.corePersonality;
    baseDetailInfo.personalityDescription = complexPersonalityEngine.generatePersonalityDescription(complexPersonality);
    
    return baseDetailInfo;
}

async function generateCharacter(message, context) {
    console.log('开始生成人物...');
    
    const useAI = context.extensionSettings[settingsKey].useAI !== false;
    
    if (useAI) {
        try {
            return await generateCharacterWithAI(message, context);
        } catch (error) {
            console.warn('AI生成失败，回退到本地生成:', error);
            const worldSetting = worldSettingDetector.detectWorldSetting(context);
            const importance = determineCharacterImportance(message, context);
            return generateCharacterLocally(message, context, worldSetting, importance);
        }
    } else {
        const worldSetting = worldSettingDetector.detectWorldSetting(context);
        const importance = determineCharacterImportance(message, context);
        return generateCharacterLocally(message, context, worldSetting, importance);
    }
}

async function detectAndProcessGrowthEvents(message, context) {
    if (!context.extensionSettings[settingsKey].enableGrowthSystem) return;
    
    const growthEvents = extractGrowthEvents(message);
    
    for (const event of growthEvents) {
        for (const [characterId, character] of characterDatabase.characters) {
            if (isEventRelevantToCharacter(event, character)) {
                const result = await growthSystem.processGrowthEvent(character, event);
                
                if (result.growthOccurred) {
                    await handleCharacterGrowth(character, result);
                    showGrowthNotification(character, result);
                }
            }
        }
    }
}

function extractGrowthEvents(message) {
    const events = [];
    
    if (message.includes('成功') || message.includes('完成') || message.includes('达成')) {
        events.push({
            type: 'success',
            description: message,
            intensity: extractEventIntensity(message)
        });
    }
    
    if (message.includes('失败') || message.includes('挫折') || message.includes('错误')) {
        events.push({
            type: 'failure',
            description: message,
            intensity: extractEventIntensity(message)
        });
    }
    
    if (message.includes('朋友') || message.includes('恋人') || message.includes('信任')) {
        events.push({
            type: 'relationship',
            description: message,
            intensity: extractEventIntensity(message)
        });
    }
    
    if (message.includes('挑战') || message.includes('困难') || message.includes('克服')) {
        events.push({
            type: 'challenge',
            description: message,
            intensity: extractEventIntensity(message)
        });
    }
    
    if (message.includes('学习') || message.includes('掌握') || message.includes('理解')) {
        events.push({
            type: 'learning',
            description: message,
            intensity: extractEventIntensity(message)
        });
    }
    
    if (message.includes('冲突') || message.includes('争论') || message.includes('战斗')) {
        events.push({
            type: 'conflict',
            description: message,
            intensity: extractEventIntensity(message)
        });
    }
    
    return events;
}

function extractEventIntensity(message) {
    const intensityKeywords = {
        high: ['非常', '极其', '巨大', '重大', '深刻', '彻底'],
        medium: ['很', '挺', '相当', '比较', '较为'],
        low: ['有点', '稍微', '略微', '一些']
    };
    
    let intensity = 0.5;
    
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

function isEventRelevantToCharacter(event, character) {
    if (event.description.includes(character.name)) {
        return true;
    }
    
    if (event.description.includes(character.basicInfo.occupation)) {
        return true;
    }
    
    if (event.description.includes(character.basicInfo.location)) {
        return true;
    }
    
    if (activeEntries.has(character.id)) {
        return true;
    }
    
    return false;
}

async function handleCharacterGrowth(character, growthResult) {
    character.lastUpdated = new Date().toISOString();
    
    await worldBookManager.updateCharacterEntry(character);
    
    updateCharacterIndex(character);
    await worldBookManager.updateIndexEntry();
    
    // 记录成长事件到时间线
    if (context.extensionSettings[settingsKey].enableTimelineManagement) {
        try {
            await timelineManager.createTimelineEvent(
                character.id,
                'character_development',
                '人物成长',
                `${character.name}经历了成长变化`,
                new Date(),
                {
                    importance: 0.6,
                    description: `在${growthResult.changes.map(c => c.area).join('、')}方面有所成长`
                }
            );
        } catch (error) {
            console.warn('记录成长事件到时间线失败:', error);
        }
    }
    
    console.log('人物成长事件:', {
        characterId: character.id,
        name: character.name,
        changes: growthResult.changes,
        worldbookUpdated: true
    });
}

function showGrowthNotification(character, growthResult) {
    const changes = growthResult.changes;
    let message = `${character.name} 有了成长！\n`;
    
    changes.forEach(change => {
        const areaName = growthSystem.growthTypes[change.area];
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
    
    showNotification(message, 'growth');
}

function cleanupExpiredData() {
    const now = Date.now();
    const expireTime = 24 * 60 * 60 * 1000;
    
    interactionHistory.forEach((history, characterId) => {
        const recentHistory = history.filter(item => 
            now - item.timestamp < expireTime
        );
        interactionHistory.set(characterId, recentHistory);
    });
    
    console.log('清理过期数据完成');
}

function saveData() {
    try {
        const data = {
            characters: Array.from(characterDatabase.characters.entries()),
            characterIndex: characterIndex,
            relationships: Array.from(relationshipNetworkManager.relationships.entries()),
            timelineEvents: Array.from(timelineManager.events.entries()),
            timestamp: new Date().toISOString()
        };
        
        localStorage.setItem('layeredCharacterSystemData', JSON.stringify(data));
        console.log('数据保存完成');
    } catch (error) {
        console.error('保存数据失败:', error);
    }
}

function loadData() {
    try {
        const saved = localStorage.getItem('layeredCharacterSystemData');
        if (saved) {
            const data = JSON.parse(saved);
            
            // 清空现有数据
            characterDatabase.clear();
            relationshipNetworkManager.relationships.clear();
            relationshipNetworkManager.characterRelationships.clear();
            timelineManager.events.clear();
            timelineManager.characterEvents.clear();
            
            // 加载人物数据
            data.characters.forEach(([id, character]) => {
                characterDatabase.addCharacter(character);
            });
            
            // 加载关系数据
            if (data.relationships) {
                data.relationships.forEach(([id, relationship]) => {
                    relationshipNetworkManager.relationships.set(id, relationship);
                    
                    // 重建人物关系索引
                    relationshipNetworkManager.addCharacterRelationship(relationship.fromCharacterId, id);
                    if (relationship.bidirectional) {
                        relationshipNetworkManager.addCharacterRelationship(relationship.toCharacterId, id);
                    }
                });
            }
            
            // 加载时间线数据
            if (data.timelineEvents) {
                data.timelineEvents.forEach(([id, event]) => {
                    timelineManager.events.set(id, event);
                    timelineManager.addCharacterEvent(event.characterId, id);
                });
            }
            
            // 重建索引
            characterIndex.length = 0;
            characterIndex.push(...data.characterIndex);
            
            console.log('数据加载完成');
        }
    } catch (error) {
        console.error('加载数据失败:', error);
    }
}

function updateInteractionHistory(message) {
    characterDatabase.characters.forEach((character, id) => {
        if (message.includes(character.name) || 
            message.includes(character.basicInfo.occupation)) {
            
            character.interactionCount++;
            character.lastUpdated = new Date().toISOString();
            
            const history = interactionHistory.get(id) || [];
            history.push({
                timestamp: Date.now(),
                message: message,
                type: 'mentioned'
            });
            interactionHistory.set(id, history);
            
            // 记录互动到关系系统
            if (context.extensionSettings[settingsKey].enableRelationshipNetwork) {
                updateRelationshipFromInteraction(id, message);
            }
            
            // 记录事件到时间线
            if (context.extensionSettings[settingsKey].enableTimelineManagement) {
                recordInteractionToTimeline(id, message);
            }
            
            if (context.extensionSettings[settingsKey].autoUpgrade) {
                importanceManager.checkImportanceUpgrade(id);
            }
        }
    });
    
    uiManager.updateStats();
}

async function updateRelationshipFromInteraction(characterId, message) {
    // 根据消息内容更新人物关系
    const mentionedCharacters = extractMentionedCharacters(message);
    
    for (const mentionedId of mentionedCharacters) {
        if (mentionedId === characterId) continue;
        
        const existingRelationship = relationshipNetworkManager.getRelationship(characterId, mentionedId);
        
        try {
            if (existingRelationship) {
                // 更新现有关系
                const sentimentChange = analyzeMessageSentiment(message);
                const newStrength = Math.min(1.0, existingRelationship.strength + 0.1);
                const newSentiment = Math.max(-1, Math.min(1, existingRelationship.sentiment + sentimentChange));
                
                await relationshipNetworkManager.updateRelationship(existingRelationship.id, {
                    strength: newStrength,
                    sentiment: newSentiment,
                    lastInteraction: new Date().toISOString()
                });
            } else {
                // 创建新关系
                const relationshipType = await relationshipNetworkManager.selectRelationshipType({
                    fromCharacterId: characterId,
                    toCharacterId: mentionedId,
                    location: characterDatabase.getCharacter(characterId)?.basicInfo.location,
                    occupation: characterDatabase.getCharacter(characterId)?.basicInfo.occupation,
                    worldSetting: characterDatabase.getCharacter(characterId)?.worldSetting,
                    extensionSettings: context.extensionSettings
                });
                await relationshipNetworkManager.createRelationship(
                    characterId,
                    mentionedId,
                    relationshipType,
                    {
                        strength: 0.3,
                        sentiment: analyzeMessageSentiment(message),
                        lastInteraction: new Date().toISOString(),
                        description: `通过互动建立${relationshipType}关系`
                    }
                );
            }
        } catch (error) {
            console.warn('更新关系失败:', error);
        }
    }
}

function extractMentionedCharacters(message) {
    const mentionedCharacters = [];
    
    characterDatabase.characters.forEach((character, id) => {
        if (message.includes(character.name)) {
            mentionedCharacters.push(id);
        }
    });
    
    return mentionedCharacters;
}

function analyzeMessageSentiment(message) {
    // 简单的情感分析
    const positiveWords = ['喜欢', '爱', '友好', '帮助', '支持', '感谢', '高兴', '开心'];
    const negativeWords = ['讨厌', '恨', '敌人', '反对', '攻击', '愤怒', '悲伤', '失望'];
    
    let sentiment = 0;
    
    positiveWords.forEach(word => {
        if (message.includes(word)) sentiment += 0.2;
    });
    
    negativeWords.forEach(word => {
        if (message.includes(word)) sentiment -= 0.2;
    });
    
    return Math.max(-1, Math.min(1, sentiment));
}

async function recordInteractionToTimeline(characterId, message) {
    try {
        const eventType = determineEventTypeFromMessage(message);
        const importance = calculateEventImportance(message);
        
        await timelineManager.createTimelineEvent(
            characterId,
            eventType,
            generateEventTitle(message),
            message,
            new Date(),
            {
                importance: importance,
                participants: extractMentionedCharacters(message)
            }
        );
    } catch (error) {
        console.warn('记录事件到时间线失败:', error);
    }
}

function determineEventTypeFromMessage(message) {
    if (message.includes('遇到') || message.includes('认识')) return 'meeting';
    if (message.includes('分别') || message.includes('离开')) return 'separation';
    if (message.includes('冲突') || message.includes('争论')) return 'conflict';
    if (message.includes('解决') || message.includes('和解')) return 'resolution';
    if (message.includes('成功') || message.includes('成就')) return 'achievement';
    if (message.includes('失败') || message.includes('挫折')) return 'failure';
    return 'interaction';
}

function calculateEventImportance(message) {
    let importance = 0.3; // 基础重要性
    
    if (message.includes('重要') || message.includes('关键')) importance += 0.3;
    if (message.includes('成功') || message.includes('成就')) importance += 0.2;
    if (message.includes('失败') || message.includes('挫折')) importance += 0.2;
    if (message.includes('第一次') || message.includes('首次')) importance += 0.2;
    
    return Math.min(1.0, importance);
}

function generateEventTitle(message) {
    // 从消息中生成事件标题
    const words = message.split(' ').slice(0, 8); // 取前8个词
    return words.join(' ') + (message.length > words.join(' ').length ? '...' : '');
}

async function handleCharacterGeneration(message) {
    const operation = performanceMonitor.startOperation('character');
    
    try {
        if (isCharacterLimitReached()) {
            showNotification('已达到人物数量限制', 'warning');
            operation.end();
            return;
        }
        
        const character = await generateCharacter(message, { message });
        
        if (character) {
            characterDatabase.addCharacter(character);
            updateCharacterIndex(character);
            
            await worldBookManager.createCharacterEntry(character);
            await worldBookManager.updateIndexEntry();
            
            showNotification(`生成新人物：${character.name}（已添加到世界书）`, 'success');
            
            uiManager.updateStats();
            
            console.log('人物生成事件:', {
                characterId: character.id,
                name: character.name,
                addedToWorldbook: true
            });
        }
        
        operation.end();
    } catch (error) {
        operation.end();
        performanceMonitor.recordError('character');
        
        console.error('人物生成失败:', error);
        showNotification('人物生成失败', 'error');
    }
}

async function handleRelationshipManagement(message) {
    if (!context.extensionSettings[settingsKey].enableRelationshipNetwork) return;
    
    const operation = performanceMonitor.startOperation('relationship');
    
    try {
        // 解析关系管理命令
        const relationshipAction = parseRelationshipAction(message);
        
        if (relationshipAction) {
            await executeRelationshipAction(relationshipAction);
        }
        
        operation.end();
    } catch (error) {
        operation.end();
        performanceMonitor.recordError('relationship');
        
        console.error('关系管理失败:', error);
        showNotification('关系管理失败', 'error');
    }
}

function parseRelationshipAction(message) {
    // 解析消息中的关系管理意图
    const patterns = [
        {
            pattern: /(.+)和(.+)成为朋友/,
            action: 'create',
            type: '朋友'
        },
        {
            pattern: /(.+)和(.+)成为敌人/,
            action: 'create',
            type: '敌人'
        },
        {
            pattern: /(.+)和(.+)关系变好/,
            action: 'update',
            change: { strength: 0.2, sentiment: 0.2 }
        },
        {
            pattern: /(.+)和(.+)关系变差/,
            action: 'update',
            change: { strength: -0.2, sentiment: -0.2 }
        }
    ];
    
    for (const pattern of patterns) {
        const match = message.match(pattern.pattern);
        if (match) {
            return {
                action: pattern.action,
                character1: match[1].trim(),
                character2: match[2].trim(),
                type: pattern.type,
                change: pattern.change
            };
        }
    }
    
    return null;
}

async function executeRelationshipAction(action) {
    const char1 = characterDatabase.findCharacterByName(action.character1);
    const char2 = characterDatabase.findCharacterByName(action.character2);
    
    if (!char1 || !char2) {
        showNotification('未找到指定的人物', 'warning');
        return;
    }
    
    try {
        if (action.action === 'create') {
            await relationshipNetworkManager.createRelationship(
                char1.id,
                char2.id,
                action.type,
                {
                    strength: 0.6,
                    sentiment: action.type === '朋友' ? 0.5 : -0.5,
                    description: `${char1.name}与${char2.name}成为${action.type}`,
                    bidirectional: true
                }
            );
            
            showNotification(`${char1.name}和${char2.name}已成为${action.type}`, 'success');
        } else if (action.action === 'update') {
            const relationship = relationshipNetworkManager.getRelationship(char1.id, char2.id);
            
            if (relationship) {
                await relationshipNetworkManager.updateRelationship(relationship.id, {
                    strength: Math.max(0, Math.min(1, relationship.strength + action.change.strength)),
                    sentiment: Math.max(-1, Math.min(1, relationship.sentiment + action.change.sentiment)),
                    lastInteraction: new Date().toISOString()
                });
                
                showNotification(`${char1.name}和${char2.name}的关系已更新`, 'success');
            } else {
                showNotification('未找到人物关系', 'warning');
            }
        }
    } catch (error) {
        console.error('执行关系操作失败:', error);
        showNotification('关系操作失败', 'error');
    }
}

async function handleTimelineManagement(message) {
    if (!context.extensionSettings[settingsKey].enableTimelineManagement) return;
    
    const operation = performanceMonitor.startOperation('timeline');
    
    try {
        // 解析时间线管理命令
        const timelineAction = parseTimelineAction(message);
        
        if (timelineAction) {
            await executeTimelineAction(timelineAction);
        }
        
        operation.end();
    } catch (error) {
        operation.end();
        performanceMonitor.recordError('timeline');
        
        console.error('时间线管理失败:', error);
        showNotification('时间线管理失败', 'error');
    }
}

function parseTimelineAction(message) {
    // 解析消息中的时间线管理意图
    const patterns = [
        {
            pattern: /为(.+)添加事件：(.+)/,
            action: 'create',
            character: 1,
            event: 2
        },
        {
            pattern: /(.+)经历了(.+)/,
            action: 'create',
            character: 1,
            event: 2
        },
        {
            pattern: /查看(.+)的时间线/,
            action: 'view',
            character: 1
        },
        {
            pattern: /显示(.+)的经历/,
            action: 'view',
            character: 1
        }
    ];
    
    for (const pattern of patterns) {
        const match = message.match(pattern.pattern);
        if (match) {
            return {
                action: pattern.action,
                character: match[pattern.character].trim(),
                event: pattern.event ? match[pattern.event].trim() : null
            };
        }
    }
    
    return null;
}

async function executeTimelineAction(action) {
    const character = characterDatabase.findCharacterByName(action.character);
    
    if (!character) {
        showNotification('未找到指定的人物', 'warning');
        return;
    }
    
    try {
        if (action.action === 'create') {
            await timelineManager.createTimelineEvent(
                character.id,
                'interaction',
                generateEventTitle(action.event),
                action.event,
                new Date(),
                {
                    importance: 0.5,
                    description: action.event
                }
            );
            
            showNotification(`已为${character.name}添加时间线事件`, 'success');
        } else if (action.action === 'view') {
            const timeline = timelineManager.getCharacterTimeline(character.id, { limit: 10 });
            const timelineText = formatTimelineForDisplay(timeline);
            
            showNotification(`${character.name}的时间线：\n${timelineText}`, 'info');
        }
    } catch (error) {
        console.error('执行时间线操作失败:', error);
        showNotification('时间线操作失败', 'error');
    }
}

function formatTimelineForDisplay(timeline) {
    if (timeline.length === 0) return '暂无时间线记录';
    
    return timeline.map(event => {
        const dateStr = new Date(event.date).toLocaleDateString();
        const importance = event.importance > 0.7 ? '（重要）' : '';
        return `${dateStr}：${event.title}${importance}`;
    }).join('\n');
}

function handleIndexQuery() {
    try {
        const indexContent = generateIndexContent();
        showNotification(indexContent, 'info');
    } catch (error) {
        console.error('处理索引查询失败:', error);
    }
}

async function initializeWorldBook() {
    try {
        await worldBookManager.updateIndexEntry();
        
        const existingCharacters = await worldBookManager.loadExistingCharacters();
        existingCharacters.forEach(character => {
            characterDatabase.addCharacter(character);
            
            if (context.extensionSettings[settingsKey].enableGrowthSystem && !character.growthData) {
                character.growthData = growthSystem.initializeCharacterGrowth(character);
            }
        });
        
        await worldBookManager.updateIndexEntry();
        
        console.log(`世界书初始化完成，加载了 ${existingCharacters.length} 个现有人物`);
    } catch (error) {
        console.error('世界书初始化失败:', error);
    }
}

function setupWorldbookMonitoring() {
    $(document).on('worldbook_updated', (e, data) => {
        console.log('世界书已更新:', data);
        
        if (data.source !== 'LayeredCharacterWorldbookSystem') {
            setTimeout(() => {
                syncFromWorldbook();
            }, 1000);
        }
    });
    
    setInterval(() => {
        checkWorldbookSync();
    }, 60000);
}

async function syncFromWorldbook() {
    try {
        const worldBook = await worldBookManager.getCurrentWorldBook();
        const worldbookCharacterIds = new Set();
        
        worldBook.entries.forEach(entry => {
            if (entry.id && entry.id.startsWith('CHAR_')) {
                worldbookCharacterIds.add(entry.id);
            }
        });
        
        const newCharacters = [];
        worldBook.entries.forEach(entry => {
            if (entry.id && entry.id.startsWith('CHAR_') && !characterDatabase.characters.has(entry.id)) {
                const character = worldBookManager.parseCharacterFromEntry(entry);
                if (character) {
                    newCharacters.push(character);
                }
            }
        });
        
        if (newCharacters.length > 0) {
            newCharacters.forEach(character => {
                characterDatabase.addCharacter(character);
            });
            uiManager.updateStats();
            console.log(`从世界书同步了 ${newCharacters.length} 个新人物`);
        }
        
        const deletedCharacters = [];
        characterDatabase.characters.forEach((character, id) => {
            if (!worldbookCharacterIds.has(id)) {
                deletedCharacters.push(id);
            }
        });
        
        if (deletedCharacters.length > 0) {
            deletedCharacters.forEach(id => {
                characterDatabase.removeCharacter(id);
            });
            uiManager.updateStats();
            console.log(`从世界书移除了 ${deletedCharacters.length} 个人物`);
        }
    } catch (error) {
        console.error('从世界书同步失败:', error);
    }
}

async function checkWorldbookSync() {
    try {
        const systemCount = characterDatabase.characters.size;
        const worldBook = await worldBookManager.getCurrentWorldBook();
        const worldbookCount = worldBook.entries.filter(entry => 
            entry.id && entry.id.startsWith('CHAR_')
        ).length;
        
        if (systemCount !== worldbookCount) {
            console.log(`检测到世界书同步差异：系统 ${systemCount} 个，世界书 ${worldbookCount} 个`);
            showNotification(`检测到世界书同步差异，正在自动同步...`, 'warning');
            await syncFromWorldbook();
        }
    } catch (error) {
        console.error('检查世界书同步状态失败:', error);
    }
}

function setupGrowthEventListeners() {
    $(document).on('character_grew', (e, characterId, growthResult) => {
        console.log(`人物成长事件：${characterId}`, growthResult);
        uiManager.updateCharacterGrowthUI(characterId);
    });
    
    $(document).on('character_milestones_achieved', (e, characterId, milestones) => {
        console.log(`人物里程碑达成：${characterId}`, milestones);
        uiManager.showMilestoneNotification(characterId, milestones);
    });
    
    $(document).on('character_growth_saved', (e, characterId, growthData) => {
        console.log(`成长数据已保存：${characterId}`);
    });
}

function addSettings() {
    const settings = context.extensionSettings[settingsKey];
    const settingsContainer = document.getElementById('layered_character_worldbook_system_container') ?? document.getElementById('extensions_settings');
    if (!settingsContainer) {
        return;
    }
    
    const inlineDrawer = document.createElement('div');
    inlineDrawer.classList.add('inline-drawer');
    settingsContainer.append(inlineDrawer);
    
    const inlineDrawerToggle = document.createElement('div');
    inlineDrawerToggle.classList.add('inline-drawer-toggle', 'inline-drawer-header');
    const extensionName = document.createElement('b');
    extensionName.textContent = context.t`Layered Character Worldbook System`;
    const inlineDrawerIcon = document.createElement('div');
    inlineDrawerIcon.classList.add('inline-drawer-icon', 'fa-solid', 'fa-circle-chevron-down', 'down');
    inlineDrawerToggle.append(extensionName, inlineDrawerIcon);
    
    const inlineDrawerContent = document.createElement('div');
    inlineDrawerContent.classList.add('inline-drawer-content');
    inlineDrawer.append(inlineDrawerToggle, inlineDrawerContent);
    
    // 基础设置
    addBasicSettings(inlineDrawerContent);
    
    // AI设置
    addAISettings(inlineDrawerContent);
    
    // 新功能设置
    addNewFeatureSettings(inlineDrawerContent);
    
    // 性能优化设置
    addPerformanceSettings(inlineDrawerContent);
    
    // 错误处理设置
    addErrorHandlingSettings(inlineDrawerContent);
    
    settingsContainer.append(inlineDrawer);
}

function addBasicSettings(container) {
    const settings = context.extensionSettings[settingsKey];
    
    // Enabled
    const enabledCheckboxLabel = document.createElement('label');
    enabledCheckboxLabel.classList.add('checkbox_label', 'marginBot5');
    enabledCheckboxLabel.htmlFor = 'layeredCharacterWorldbookSystemEnabled';
    const enabledCheckbox = document.createElement('input');
    enabledCheckbox.id = 'layeredCharacterWorldbookSystemEnabled';
    enabledCheckbox.type = 'checkbox';
    enabledCheckbox.checked = settings.enabled;
    enabledCheckbox.addEventListener('change', () => {
        settings.enabled = enabledCheckbox.checked;
        context.saveSettingsDebounced();
    });
    const enabledCheckboxText = document.createElement('span');
    enabledCheckboxText.textContent = context.t`Enabled`;
    enabledCheckboxLabel.append(enabledCheckbox, enabledCheckboxText);
    container.append(enabledCheckboxLabel);
    
    // Auto Generate
    const autoGenerateCheckboxLabel = document.createElement('label');
    autoGenerateCheckboxLabel.classList.add('checkbox_label', 'marginBot5');
    autoGenerateCheckboxLabel.htmlFor = 'layeredCharacterWorldbookSystemAutoGenerate';
    const autoGenerateCheckbox = document.createElement('input');
    autoGenerateCheckbox.id = 'layeredCharacterWorldbookSystemAutoGenerate';
    autoGenerateCheckbox.type = 'checkbox';
    autoGenerateCheckbox.checked = settings.autoGenerate;
    autoGenerateCheckbox.addEventListener('change', () => {
        settings.autoGenerate = autoGenerateCheckbox.checked;
        context.saveSettingsDebounced();
    });
    const autoGenerateCheckboxText = document.createElement('span');
    autoGenerateCheckboxText.textContent = context.t`Auto Generate Characters`;
    autoGenerateCheckboxLabel.append(autoGenerateCheckbox, autoGenerateCheckboxText);
    container.append(autoGenerateCheckboxLabel);
    
    // Max Main Characters
    const maxMainCharactersLabel = document.createElement('label');
    maxMainCharactersLabel.htmlFor = 'layeredCharacterWorldbookSystemMaxMainCharacters';
    maxMainCharactersLabel.textContent = context.t`Max Main Characters`;
    const maxMainCharactersInput = document.createElement('input');
    maxMainCharactersInput.id = 'layeredCharacterWorldbookSystemMaxMainCharacters';
    maxMainCharactersInput.type = 'number';
    maxMainCharactersInput.min = String(0);
    maxMainCharactersInput.max = String(20);
    maxMainCharactersInput.step = String(1);
    maxMainCharactersInput.value = String(settings.maxMainCharacters);
    maxMainCharactersInput.classList.add('text_pole');
    maxMainCharactersInput.addEventListener('input', () => {
        settings.maxMainCharacters = Math.max(0, Math.round(Number(maxMainCharactersInput.value)));
        context.saveSettingsDebounced();
    });
    container.append(maxMainCharactersLabel, maxMainCharactersInput);
    
    // Max Secondary Characters
    const maxSecondaryCharactersLabel = document.createElement('label');
    maxSecondaryCharactersLabel.htmlFor = 'layeredCharacterWorldbookSystemMaxSecondaryCharacters';
    maxSecondaryCharactersLabel.textContent = context.t`Max Secondary Characters`;
    const maxSecondaryCharactersInput = document.createElement('input');
    maxSecondaryCharactersInput.id = 'layeredCharacterWorldbookSystemMaxSecondaryCharacters';
    maxSecondaryCharactersInput.type = 'number';
    maxSecondaryCharactersInput.min = String(0);
    maxSecondaryCharactersInput.max = String(50);
    maxSecondaryCharactersInput.step = String(1);
    maxSecondaryCharactersInput.value = String(settings.maxSecondaryCharacters);
    maxSecondaryCharactersInput.classList.add('text_pole');
    maxSecondaryCharactersInput.addEventListener('input', () => {
        settings.maxSecondaryCharacters = Math.max(0, Math.round(Number(maxSecondaryCharactersInput.value)));
        context.saveSettingsDebounced();
    });
    container.append(maxSecondaryCharactersLabel, maxSecondaryCharactersInput);
    
    // Max Background Characters
    const maxBackgroundCharactersLabel = document.createElement('label');
    maxBackgroundCharactersLabel.htmlFor = 'layeredCharacterWorldbookSystemMaxBackgroundCharacters';
    maxBackgroundCharactersLabel.textContent = context.t`Max Background Characters`;
    const maxBackgroundCharactersInput = document.createElement('input');
    maxBackgroundCharactersInput.id = 'layeredCharacterWorldbookSystemMaxBackgroundCharacters';
    maxBackgroundCharactersInput.type = 'number';
    maxBackgroundCharactersInput.min = String(0);
    maxBackgroundCharactersInput.max = String(100);
    maxBackgroundCharactersInput.step = String(1);
    maxBackgroundCharactersInput.value = String(settings.maxBackgroundCharacters);
    maxBackgroundCharactersInput.classList.add('text_pole');
    maxBackgroundCharactersInput.addEventListener('input', () => {
        settings.maxBackgroundCharacters = Math.max(0, Math.round(Number(maxBackgroundCharactersInput.value)));
        context.saveSettingsDebounced();
    });
    container.append(maxBackgroundCharactersLabel, maxBackgroundCharactersInput);
    
    // Token Budget
    const tokenBudgetLabel = document.createElement('label');
    tokenBudgetLabel.htmlFor = 'layeredCharacterWorldbookSystemTokenBudget';
    tokenBudgetLabel.textContent = context.t`Token Budget`;
    const tokenBudgetInput = document.createElement('input');
    tokenBudgetInput.id = 'layeredCharacterWorldbookSystemTokenBudget';
    tokenBudgetInput.type = 'number';
    tokenBudgetInput.min = String(500);
    tokenBudgetInput.max = String(10000);
    tokenBudgetInput.step = String(100);
    tokenBudgetInput.value = String(settings.tokenBudget);
    tokenBudgetInput.classList.add('text_pole');
    tokenBudgetInput.addEventListener('input', () => {
        settings.tokenBudget = Math.max(500, Math.round(Number(tokenBudgetInput.value)));
        context.saveSettingsDebounced();
    });
    container.append(tokenBudgetLabel, tokenBudgetInput);
    
    // Auto Upgrade
    const autoUpgradeCheckboxLabel = document.createElement('label');
    autoUpgradeCheckboxLabel.classList.add('checkbox_label', 'marginBot5');
    autoUpgradeCheckboxLabel.htmlFor = 'layeredCharacterWorldbookSystemAutoUpgrade';
    const autoUpgradeCheckbox = document.createElement('input');
    autoUpgradeCheckbox.id = 'layeredCharacterWorldbookSystemAutoUpgrade';
    autoUpgradeCheckbox.type = 'checkbox';
    autoUpgradeCheckbox.checked = settings.autoUpgrade;
    autoUpgradeCheckbox.addEventListener('change', () => {
        settings.autoUpgrade = autoUpgradeCheckbox.checked;
        context.saveSettingsDebounced();
    });
    const autoUpgradeCheckboxText = document.createElement('span');
    autoUpgradeCheckboxText.textContent = context.t`Auto Upgrade Importance`;
    autoUpgradeCheckboxLabel.append(autoUpgradeCheckbox, autoUpgradeCheckboxText);
    container.append(autoUpgradeCheckboxLabel);
    
    // Enable Growth System
    const enableGrowthSystemCheckboxLabel = document.createElement('label');
    enableGrowthSystemCheckboxLabel.classList.add('checkbox_label', 'marginBot5');
    enableGrowthSystemCheckboxLabel.htmlFor = 'layeredCharacterWorldbookSystemEnableGrowthSystem';
    const enableGrowthSystemCheckbox = document.createElement('input');
    enableGrowthSystemCheckbox.id = 'layeredCharacterWorldbookSystemEnableGrowthSystem';
    enableGrowthSystemCheckbox.type = 'checkbox';
    enableGrowthSystemCheckbox.checked = settings.enableGrowthSystem;
    enableGrowthSystemCheckbox.addEventListener('change', () => {
        settings.enableGrowthSystem = enableGrowthSystemCheckbox.checked;
        context.saveSettingsDebounced();
    });
    const enableGrowthSystemCheckboxText = document.createElement('span');
    enableGrowthSystemCheckboxText.textContent = context.t`Enable Growth System`;
    enableGrowthSystemCheckboxLabel.append(enableGrowthSystemCheckbox, enableGrowthSystemCheckboxText);
    container.append(enableGrowthSystemCheckboxLabel);
}

function addAISettings(container) {
    const settings = context.extensionSettings[settingsKey];
    
    // AI设置区域
    const aiSettingsHeader = document.createElement('h4');
    aiSettingsHeader.textContent = context.t`AI Generation Settings`;
    aiSettingsHeader.style.marginTop = '20px';
    aiSettingsHeader.style.marginBottom = '10px';
    container.appendChild(aiSettingsHeader);
    
    // Use AI
    const useAICheckboxLabel = document.createElement('label');
    useAICheckboxLabel.classList.add('checkbox_label', 'marginBot5');
    useAICheckboxLabel.htmlFor = 'layeredCharacterWorldbookSystemUseAI';
    const useAICheckbox = document.createElement('input');
    useAICheckbox.id = 'layeredCharacterWorldbookSystemUseAI';
    useAICheckbox.type = 'checkbox';
    useAICheckbox.checked = settings.useAI;
    useAICheckbox.addEventListener('change', () => {
        settings.useAI = useAICheckbox.checked;
        context.saveSettingsDebounced();
    });
    const useAICheckboxText = document.createElement('span');
    useAICheckboxText.textContent = context.t`Use AI for Character Generation`;
    useAICheckboxLabel.append(useAICheckbox, useAICheckboxText);
    container.append(useAICheckboxLabel);
    
    // AI API选择
    const apiSelectLabel = document.createElement('label');
    apiSelectLabel.htmlFor = 'layeredCharacterWorldbookSystemAIApi';
    apiSelectLabel.textContent = context.t`AI API`;
    const apiSelect = document.createElement('select');
    apiSelect.id = 'layeredCharacterWorldbookSystemAIApi';
    apiSelect.classList.add('text_pole');
    
    const apiOptions = [
        { value: 'main', text: 'Main API' },
        { value: 'secondary', text: 'Secondary API' },
        { value: 'custom', text: 'Custom API' }
    ];
    
    apiOptions.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.value;
        optionElement.textContent = option.text;
        if (option.value === settings.aiApi) {
            optionElement.selected = true;
        }
        apiSelect.appendChild(optionElement);
    });
    
    apiSelect.addEventListener('change', () => {
        settings.aiApi = apiSelect.value;
        context.saveSettingsDebounced();
    });
    
    apiSelectLabel.appendChild(apiSelect);
    container.appendChild(apiSelectLabel);
    
    // AI Temperature
    const aiTemperatureLabel = document.createElement('label');
    aiTemperatureLabel.htmlFor = 'layeredCharacterWorldbookSystemAITemperature';
    aiTemperatureLabel.textContent = context.t`AI Creativity (Temperature)`;
    const aiTemperatureInput = document.createElement('input');
    aiTemperatureInput.id = 'layeredCharacterWorldbookSystemAITemperature';
    aiTemperatureInput.type = 'range';
    aiTemperatureInput.min = String(0);
    aiTemperatureInput.max = String(2);
    aiTemperatureInput.step = String(0.1);
    aiTemperatureInput.value = String(settings.aiTemperature);
    aiTemperatureInput.classList.add('text_pole');
    aiTemperatureInput.addEventListener('input', () => {
        settings.aiTemperature = parseFloat(aiTemperatureInput.value);
        context.saveSettingsDebounced();
    });
    const aiTemperatureValue = document.createElement('span');
    aiTemperatureValue.textContent = settings.aiTemperature.toFixed(1);
    aiTemperatureValue.style.marginLeft = '10px';
    aiTemperatureInput.addEventListener('input', () => {
        aiTemperatureValue.textContent = parseFloat(aiTemperatureInput.value).toFixed(1);
    });
    container.append(aiTemperatureLabel, aiTemperatureInput, aiTemperatureValue);
    
    // AI Max Tokens
    const aiMaxTokensLabel = document.createElement('label');
    aiMaxTokensLabel.htmlFor = 'layeredCharacterWorldbookSystemAIMaxTokens';
    aiMaxTokensLabel.textContent = context.t`AI Max Tokens`;
    const aiMaxTokensInput = document.createElement('input');
    aiMaxTokensInput.id = 'layeredCharacterWorldbookSystemAIMaxTokens';
    aiMaxTokensInput.type = 'number';
    aiMaxTokensInput.min = String(100);
    aiMaxTokensInput.max = String(2000);
    aiMaxTokensInput.step = String(50);
    aiMaxTokensInput.value = String(settings.aiMaxTokens);
    aiMaxTokensInput.classList.add('text_pole');
    aiMaxTokensInput.addEventListener('input', () => {
        settings.aiMaxTokens = Math.max(100, Math.round(Number(aiMaxTokensInput.value)));
        context.saveSettingsDebounced();
    });
    container.append(aiMaxTokensLabel, aiMaxTokensInput);
    
    // AI Fallback to Local
    const aiFallbackCheckboxLabel = document.createElement('label');
    aiFallbackCheckboxLabel.classList.add('checkbox_label', 'marginBot5');
    aiFallbackCheckboxLabel.htmlFor = 'layeredCharacterWorldbookSystemAIFallbackToLocal';
    const aiFallbackCheckbox = document.createElement('input');
    aiFallbackCheckbox.id = 'layeredCharacterWorldbookSystemAIFallbackToLocal';
    aiFallbackCheckbox.type = 'checkbox';
    aiFallbackCheckbox.checked = settings.aiFallbackToLocal;
    aiFallbackCheckbox.addEventListener('change', () => {
        settings.aiFallbackToLocal = aiFallbackCheckbox.checked;
        context.saveSettingsDebounced();
    });
    const aiFallbackCheckboxText = document.createElement('span');
    aiFallbackCheckboxText.textContent = context.t`Fallback to Local Generation if AI Fails`;
    aiFallbackCheckboxLabel.append(aiFallbackCheckbox, aiFallbackCheckboxText);
    container.append(aiFallbackCheckboxLabel);
}

function addNewFeatureSettings(container) {
    const settings = context.extensionSettings[settingsKey];
    
    // 新功能设置区域
    const newFeaturesHeader = document.createElement('h4');
    newFeaturesHeader.textContent = context.t`New Features Settings`;
    newFeaturesHeader.style.marginTop = '20px';
    newFeaturesHeader.style.marginBottom = '10px';
    container.appendChild(newFeaturesHeader);
    
    // Enable Relationship Network
    const relationshipNetworkCheckboxLabel = document.createElement('label');
    relationshipNetworkCheckboxLabel.classList.add('checkbox_label', 'marginBot5');
    relationshipNetworkCheckboxLabel.htmlFor = 'layeredCharacterWorldbookSystemEnableRelationshipNetwork';
    const relationshipNetworkCheckbox = document.createElement('input');
    relationshipNetworkCheckbox.id = 'layeredCharacterWorldbookSystemEnableRelationshipNetwork';
    relationshipNetworkCheckbox.type = 'checkbox';
    relationshipNetworkCheckbox.checked = settings.enableRelationshipNetwork;
    relationshipNetworkCheckbox.addEventListener('change', () => {
        settings.enableRelationshipNetwork = relationshipNetworkCheckbox.checked;
        context.saveSettingsDebounced();
    });
    const relationshipNetworkCheckboxText = document.createElement('span');
    relationshipNetworkCheckboxText.textContent = context.t`Enable Relationship Network System`;
    relationshipNetworkCheckboxLabel.append(relationshipNetworkCheckbox, relationshipNetworkCheckboxText);
    container.append(relationshipNetworkCheckboxLabel);
    
    // Enable Timeline Management
    const timelineManagementCheckboxLabel = document.createElement('label');
    timelineManagementCheckboxLabel.classList.add('checkbox_label', 'marginBot5');
    timelineManagementCheckboxLabel.htmlFor = 'layeredCharacterWorldbookSystemEnableTimelineManagement';
    const timelineManagementCheckbox = document.createElement('input');
    timelineManagementCheckbox.id = 'layeredCharacterWorldbookSystemEnableTimelineManagement';
    timelineManagementCheckbox.type = 'checkbox';
    timelineManagementCheckbox.checked = settings.enableTimelineManagement;
    timelineManagementCheckbox.addEventListener('change', () => {
        settings.enableTimelineManagement = timelineManagementCheckbox.checked;
        context.saveSettingsDebounced();
    });
    const timelineManagementCheckboxText = document.createElement('span');
    timelineManagementCheckboxText.textContent = context.t`Enable Timeline Management System`;
    timelineManagementCheckboxLabel.append(timelineManagementCheckbox, timelineManagementCheckboxText);
    container.append(timelineManagementCheckboxLabel);
    
    // Max Relationships Per Character
    const maxRelationshipsLabel = document.createElement('label');
    maxRelationshipsLabel.htmlFor = 'layeredCharacterWorldbookSystemMaxRelationshipsPerCharacter';
    maxRelationshipsLabel.textContent = context.t`Max Relationships Per Character`;
    const maxRelationshipsInput = document.createElement('input');
    maxRelationshipsInput.id = 'layeredCharacterWorldbookSystemMaxRelationshipsPerCharacter';
    maxRelationshipsInput.type = 'number';
    maxRelationshipsInput.min = String(1);
    maxRelationshipsInput.max = String(50);
    maxRelationshipsInput.step = String(1);
    maxRelationshipsInput.value = String(settings.maxRelationshipsPerCharacter);
    maxRelationshipsInput.classList.add('text_pole');
    maxRelationshipsInput.addEventListener('input', () => {
        settings.maxRelationshipsPerCharacter = Math.max(1, Math.round(Number(maxRelationshipsInput.value)));
        context.saveSettingsDebounced();
    });
    container.append(maxRelationshipsLabel, maxRelationshipsInput);
    
    // Max Timeline Events Per Character
    const maxTimelineEventsLabel = document.createElement('label');
    maxTimelineEventsLabel.htmlFor = 'layeredCharacterWorldbookSystemMaxTimelineEventsPerCharacter';
    maxTimelineEventsLabel.textContent = context.t`Max Timeline Events Per Character`;
    const maxTimelineEventsInput = document.createElement('input');
    maxTimelineEventsInput.id = 'layeredCharacterWorldbookSystemMaxTimelineEventsPerCharacter';
    maxTimelineEventsInput.type = 'number';
    maxTimelineEventsInput.min = String(10);
    maxTimelineEventsInput.max = String(200);
    maxTimelineEventsInput.step = String(10);
    maxTimelineEventsInput.value = String(settings.maxTimelineEventsPerCharacter);
    maxTimelineEventsInput.classList.add('text_pole');
    maxTimelineEventsInput.addEventListener('input', () => {
        settings.maxTimelineEventsPerCharacter = Math.max(10, Math.round(Number(maxTimelineEventsInput.value)));
        context.saveSettingsDebounced();
    });
    container.append(maxTimelineEventsLabel, maxTimelineEventsInput);
}

function addPerformanceSettings(container) {
    const settings = context.extensionSettings[settingsKey];
    
    // 性能优化设置区域
    const performanceHeader = document.createElement('h4');
    performanceHeader.textContent = context.t`Performance Optimization Settings`;
    performanceHeader.style.marginTop = '20px';
    performanceHeader.style.marginBottom = '10px';
    container.appendChild(performanceHeader);
    
    // Enable Virtual Scrolling
    const virtualScrollingCheckboxLabel = document.createElement('label');
    virtualScrollingCheckboxLabel.classList.add('checkbox_label', 'marginBot5');
    virtualScrollingCheckboxLabel.htmlFor = 'layeredCharacterWorldbookSystemEnableVirtualScrolling';
    const virtualScrollingCheckbox = document.createElement('input');
    virtualScrollingCheckbox.id = 'layeredCharacterWorldbookSystemEnableVirtualScrolling';
    virtualScrollingCheckbox.type = 'checkbox';
    virtualScrollingCheckbox.checked = settings.enableVirtualScrolling;
    virtualScrollingCheckbox.addEventListener('change', () => {
        settings.enableVirtualScrolling = virtualScrollingCheckbox.checked;
        context.saveSettingsDebounced();
    });
    const virtualScrollingCheckboxText = document.createElement('span');
    virtualScrollingCheckboxText.textContent = context.t`Enable Virtual Scrolling`;
    virtualScrollingCheckboxLabel.append(virtualScrollingCheckbox, virtualScrollingCheckboxText);
    container.append(virtualScrollingCheckboxLabel);
    
    // Virtual Scroll Item Height
    const virtualScrollItemHeightLabel = document.createElement('label');
    virtualScrollItemHeightLabel.htmlFor = 'layeredCharacterWorldbookSystemVirtualScrollItemHeight';
    virtualScrollItemHeightLabel.textContent = context.t`Virtual Scroll Item Height (px)`;
    const virtualScrollItemHeightInput = document.createElement('input');
    virtualScrollItemHeightInput.id = 'layeredCharacterWorldbookSystemVirtualScrollItemHeight';
    virtualScrollItemHeightInput.type = 'number';
    virtualScrollItemHeightInput.min = String(30);
    virtualScrollItemHeightInput.max = String(200);
    virtualScrollItemHeightInput.step = String(10);
    virtualScrollItemHeightInput.value = String(settings.virtualScrollItemHeight);
    virtualScrollItemHeightInput.classList.add('text_pole');
    virtualScrollItemHeightInput.addEventListener('input', () => {
        settings.virtualScrollItemHeight = Math.max(30, Math.round(Number(virtualScrollItemHeightInput.value)));
        context.saveSettingsDebounced();
    });
    container.append(virtualScrollItemHeightLabel, virtualScrollItemHeightInput);
    
    // Max Cache Size
    const maxCacheSizeLabel = document.createElement('label');
    maxCacheSizeLabel.htmlFor = 'layeredCharacterWorldbookSystemMaxCacheSize';
    maxCacheSizeLabel.textContent = context.t`Max Cache Size`;
    const maxCacheSizeInput = document.createElement('input');
    maxCacheSizeInput.id = 'layeredCharacterWorldbookSystemMaxCacheSize';
    maxCacheSizeInput.type = 'number';
    maxCacheSizeInput.min = String(50);
    maxCacheSizeInput.max = String(1000);
    maxCacheSizeInput.step = String(50);
    maxCacheSizeInput.value = String(settings.maxCacheSize);
    maxCacheSizeInput.classList.add('text_pole');
    maxCacheSizeInput.addEventListener('input', () => {
        settings.maxCacheSize = Math.max(50, Math.round(Number(maxCacheSizeInput.value)));
        context.saveSettingsDebounced();
    });
    container.append(maxCacheSizeLabel, maxCacheSizeInput);
}

function addErrorHandlingSettings(container) {
    const settings = context.extensionSettings[settingsKey];
    
    // 错误处理设置区域
    const errorHandlingHeader = document.createElement('h4');
    errorHandlingHeader.textContent = context.t`Error Handling Settings`;
    errorHandlingHeader.style.marginTop = '20px';
    errorHandlingHeader.style.marginBottom = '10px';
    container.appendChild(errorHandlingHeader);
    
    // Enable Error Recovery
    const errorRecoveryCheckboxLabel = document.createElement('label');
    errorRecoveryCheckboxLabel.classList.add('checkbox_label', 'marginBot5');
    errorRecoveryCheckboxLabel.htmlFor = 'layeredCharacterWorldbookSystemEnableErrorRecovery';
    const errorRecoveryCheckbox = document.createElement('input');
    errorRecoveryCheckbox.id = 'layeredCharacterWorldbookSystemEnableErrorRecovery';
    errorRecoveryCheckbox.type = 'checkbox';
    errorRecoveryCheckbox.checked = settings.enableErrorRecovery;
    errorRecoveryCheckbox.addEventListener('change', () => {
        settings.enableErrorRecovery = errorRecoveryCheckbox.checked;
        context.saveSettingsDebounced();
    });
    const errorRecoveryCheckboxText = document.createElement('span');
    errorRecoveryCheckboxText.textContent = context.t`Enable Automatic Error Recovery`;
    errorRecoveryCheckboxLabel.append(errorRecoveryCheckbox, errorRecoveryCheckboxText);
    container.append(errorRecoveryCheckboxLabel);
    
    // Max Retry Attempts
    const maxRetryAttemptsLabel = document.createElement('label');
    maxRetryAttemptsLabel.htmlFor = 'layeredCharacterWorldbookSystemMaxRetryAttempts';
    maxRetryAttemptsLabel.textContent = context.t`Max Retry Attempts`;
    const maxRetryAttemptsInput = document.createElement('input');
    maxRetryAttemptsInput.id = 'layeredCharacterWorldbookSystemMaxRetryAttempts';
    maxRetryAttemptsInput.type = 'number';
    maxRetryAttemptsInput.min = String(1);
    maxRetryAttemptsInput.max = String(10);
    maxRetryAttemptsInput.step = String(1);
    maxRetryAttemptsInput.value = String(settings.maxRetryAttempts);
    maxRetryAttemptsInput.classList.add('text_pole');
    maxRetryAttemptsInput.addEventListener('input', () => {
        settings.maxRetryAttempts = Math.max(1, Math.round(Number(maxRetryAttemptsInput.value)));
        context.saveSettingsDebounced();
    });
    container.append(maxRetryAttemptsLabel, maxRetryAttemptsInput);
}

function addCommands() {
    // 启用/禁用系统
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'lcws-state',
        helpString: 'Change the state of the Layered Character Worldbook System. If no argument is provided, return the current state.',
        returns: 'boolean',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Desired state of the system.',
                typeList: ARGUMENT_TYPE.STRING,
                isRequired: true,
                acceptsMultiple: false,
                enumProvider: commonEnumProviders.boolean('onOffToggle'),
            }),
        ],
        callback: (_, state) => {
            if (state && typeof state === 'string') {
                switch (String(state).trim().toLowerCase()) {
                    case 'toggle':
                    case 't':
                        context.extensionSettings[settingsKey].enabled = !context.extensionSettings[settingsKey].enabled;
                        break;
                    default:
                        context.extensionSettings[settingsKey].enabled = isTrueBoolean(String(state));
                }
                const checkbox = document.getElementById('layeredCharacterWorldbookSystemEnabled');
                if (checkbox instanceof HTMLInputElement) {
                    checkbox.checked = context.extensionSettings[settingsKey].enabled;
                    checkbox.dispatchEvent(new Event('input', { bubbles: true }));
                }
                context.saveSettingsDebounced();
            }
            return String(context.extensionSettings[settingsKey].enabled);
        },
    }));
    
    // 生成人物
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'lcws-generate',
        helpString: 'Generate a new character.',
        callback: async () => {
            if (!context.extensionSettings[settingsKey].enabled) {
                return 'System is disabled';
            }
            
            if (isCharacterLimitReached()) {
                return 'Character limit reached';
            }
            
            const character = await generateCharacter('手动生成', { message: '手动生成' });
            if (character) {
                characterDatabase.addCharacter(character);
                updateCharacterIndex(character);
                await worldBookManager.createCharacterEntry(character);
                await worldBookManager.updateIndexEntry();
                uiManager.updateStats();
                return `Generated character: ${character.name}`;
            }
            
            return 'Failed to generate character';
        },
    }));
    
    // 显示人物索引
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'lcws-index',
        helpString: 'Show character index.',
        callback: () => {
            if (!context.extensionSettings[settingsKey].enabled) {
                return 'System is disabled';
            }
            
            return generateIndexContent();
        },
    }));
    
    // 清空所有人物
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'lcws-clear',
        helpString: 'Clear all characters.',
        callback: async () => {
            if (!context.extensionSettings[settingsKey].enabled) {
                return 'System is disabled';
            }
            
            // 从世界书删除所有人物条目
            for (const characterId of characterDatabase.characters.keys()) {
                await worldBookManager.deleteCharacterEntry(characterId);
            }
            
            characterDatabase.clear();
            characterIndex.length = 0;
            uiManager.updateStats();
            await worldBookManager.updateIndexEntry();
            return 'All characters cleared';
        },
    }));
    
    // 获取人物成长报告
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'lcws-growth',
        helpString: 'Get character growth report. Usage: /lcws-growth [character_name]',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Character name',
                typeList: ARGUMENT_TYPE.STRING,
                isRequired: false,
                acceptsMultiple: false,
            }),
        ],
        callback: async (_, characterName) => {
            if (!context.extensionSettings[settingsKey].enabled) {
                return 'System is disabled';
            }
            
            if (!context.extensionSettings[settingsKey].enableGrowthSystem) {
                return 'Growth system is disabled';
            }
            
            if (!characterName) {
                let report = '=== 人物成长报告 ===\n\n';
                characterDatabase.characters.forEach((character, id) => {
                    if (character.growthData) {
                        const growthReport = growthSystem.getGrowthReport(character);
                        report += `${character.name}: ${growthReport.summary}\n`;
                    }
                });
                return report || 'No growth data available';
            }
            
            let foundCharacter = null;
            characterDatabase.characters.forEach((character) => {
                if (character.name === characterName) {
                    foundCharacter = character;
                }
            });
            
            if (!foundCharacter) {
                return `Character "${characterName}" not found`;
            }
            
            if (!foundCharacter.growthData) {
                return `Character "${characterName}" has no growth data`;
            }
            
            const growthReport = growthSystem.getGrowthReport(foundCharacter);
            let report = `=== ${foundCharacter.name} 成长报告 ===\n\n`;
            report += `${growthReport.summary}\n\n`;
            
            report += '各领域详情:\n';
            Object.keys(growthReport.areas).forEach(area => {
                const areaData = growthReport.areas[area];
                report += `- ${areaData.name}: ${areaData.level}级 (${areaData.experience}经验)\n`;
            });
            
            if (growthReport.milestones.length > 0) {
                report += '\n里程碑:\n';
                growthReport.milestones.forEach(milestone => {
                    report += `- ${milestone.description}\n`;
                });
            }
            
            return report;
        },
    }));
    
    // AI生成测试命令
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'lcws-ai-test',
        helpString: 'Test AI character generation with custom prompt.',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Generation prompt',
                typeList: ARGUMENT_TYPE.STRING,
                isRequired: true,
                acceptsMultiple: false,
            }),
        ],
        callback: async (_, prompt) => {
            if (!context.extensionSettings[settingsKey].enabled) {
                return 'System is disabled';
            }
            
            if (!context.extensionSettings[settingsKey].useAI) {
                return 'AI generation is disabled';
            }
            
            showNotification('正在测试AI生成...', 'info');
            
            try {
                const character = await generateCharacterWithAI(prompt, { message: prompt });
                characterDatabase.addCharacter(character);
                updateCharacterIndex(character);
                await worldBookManager.createCharacterEntry(character);
                await worldBookManager.updateIndexEntry();
                uiManager.updateStats();
                return `AI生成成功: ${character.name}\n${character.detailInfo.personality}`;
            } catch (error) {
                return `AI生成失败: ${error.message}`;
            }
        },
    }));
    
    // 切换AI/本地生成
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'lcws-ai-toggle',
        helpString: 'Toggle between AI and local character generation.',
        callback: () => {
            context.extensionSettings[settingsKey].useAI = !context.extensionSettings[settingsKey].useAI;
            context.saveSettingsDebounced();
            
            const checkbox = document.getElementById('layeredCharacterWorldbookSystemUseAI');
            if (checkbox instanceof HTMLInputElement) {
                checkbox.checked = context.extensionSettings[settingsKey].useAI;
            }
            
            return `AI生成已${context.extensionSettings[settingsKey].useAI ? '启用' : '禁用'}`;
        },
    }));
    
    // 关系管理命令
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'lcws-relation',
        helpString: 'Manage character relationships. Usage: /lcws-relation [action] [character1] [character2] [type]',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Action (create, update, view, delete)',
                typeList: ARGUMENT_TYPE.STRING,
                isRequired: false,
                acceptsMultiple: false,
            }),
            SlashCommandArgument.fromProps({
                description: 'First character name',
                typeList: ARGUMENT_TYPE.STRING,
                isRequired: false,
                acceptsMultiple: false,
            }),
            SlashCommandArgument.fromProps({
                description: 'Second character name',
                typeList: ARGUMENT_TYPE.STRING,
                isRequired: false,
                acceptsMultiple: false,
            }),
            SlashCommandArgument.fromProps({
                description: 'Relationship type',
                typeList: ARGUMENT_TYPE.STRING,
                isRequired: false,
                acceptsMultiple: false,
            }),
        ],
        callback: async (_, action, character1, character2, type) => {
            if (!context.extensionSettings[settingsKey].enabled) {
                return 'System is disabled';
            }
            
            if (!context.extensionSettings[settingsKey].enableRelationshipNetwork) {
                return 'Relationship network system is disabled';
            }
            
            if (!action) {
                return 'Usage: /lcws-relation [create|update|view|delete] [character1] [character2] [type]';
            }
            
            switch (action.toLowerCase()) {
                case 'create':
                    if (!character1 || !character2 || !type) {
                        return 'Usage: /lcws-relation create [character1] [character2] [type]';
                    }
                    
                    const char1 = characterDatabase.findCharacterByName(character1);
                    const char2 = characterDatabase.findCharacterByName(character2);
                    
                    if (!char1 || !char2) {
                        return 'One or both characters not found';
                    }
                    
                    try {
                        await relationshipNetworkManager.createRelationship(
                            char1.id,
                            char2.id,
                            type,
                            {
                                strength: 0.6,
                                sentiment: 0.5,
                                description: `${char1.name}与${char2.name}是${type}`,
                                bidirectional: true
                            }
                        );
                        
                        return `Created relationship: ${character1} -> ${character2} (${type})`;
                    } catch (error) {
                        return `Failed to create relationship: ${error.message}`;
                    }
                    
                case 'view':
                    if (!character1) {
                        return 'Usage: /lcws-relation view [character_name]';
                    }
                    
                    const character = characterDatabase.findCharacterByName(character1);
                    if (!character) {
                        return `Character "${character1}" not found`;
                    }
                    
                    const analysis = relationshipNetworkManager.getNetworkAnalysis(character.id);
                    const relationshipText = relationshipNetworkManager.generateNetworkTextForAI(character.id, {});
                    
                    let result = `=== ${character.name} 关系网络分析 ===\n\n`;
                    result += `关系总数: ${analysis.totalConnections}\n`;
                    result += `平均关系强度: ${(analysis.averageStrength * 100).toFixed(1)}%\n\n`;
                    result += relationshipText;
                    
                    return result;
                    
                case 'delete':
                    if (!character1 || !character2) {
                        return 'Usage: /lcws-relation delete [character1] [character2]';
                    }
                    
                    const delChar1 = characterDatabase.findCharacterByName(character1);
                    const delChar2 = characterDatabase.findCharacterByName(character2);
                    
                    if (!delChar1 || !delChar2) {
                        return 'One or both characters not found';
                    }
                    
                    const relationship = relationshipNetworkManager.getRelationship(delChar1.id, delChar2.id);
                    if (!relationship) {
                        return 'Relationship not found';
                    }
                    
                    try {
                        await relationshipNetworkManager.deleteRelationship(relationship.id);
                        return `Deleted relationship: ${character1} -> ${character2}`;
                    } catch (error) {
                        return `Failed to delete relationship: ${error.message}`;
                    }
                    
                default:
                    return 'Invalid action. Use: create, update, view, or delete';
            }
        },
    }));
    
    // 时间线管理命令
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'lcws-timeline',
        helpString: 'Manage character timeline. Usage: /lcws-timeline [action] [character] [event]',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Action (add, view, clear)',
                typeList: ARGUMENT_TYPE.STRING,
                isRequired: false,
                acceptsMultiple: false,
            }),
            SlashCommandArgument.fromProps({
                description: 'Character name',
                typeList: ARGUMENT_TYPE.STRING,
                isRequired: false,
                acceptsMultiple: false,
            }),
            SlashCommandArgument.fromProps({
                description: 'Event description',
                typeList: ARGUMENT_TYPE.STRING,
                isRequired: false,
                acceptsMultiple: false,
            }),
        ],
        callback: async (_, action, character, event) => {
            if (!context.extensionSettings[settingsKey].enabled) {
                return 'System is disabled';
            }
            
            if (!context.extensionSettings[settingsKey].enableTimelineManagement) {
                return 'Timeline management system is disabled';
            }
            
            if (!action) {
                return 'Usage: /lcws-timeline [add|view|clear] [character] [event]';
            }
            
            switch (action.toLowerCase()) {
                case 'add':
                    if (!character || !event) {
                        return 'Usage: /lcws-timeline add [character] [event]';
                    }
                    
                    const targetChar = characterDatabase.findCharacterByName(character);
                    if (!targetChar) {
                        return `Character "${character}" not found`;
                    }
                    
                    try {
                        await timelineManager.createTimelineEvent(
                            targetChar.id,
                            'interaction',
                            generateEventTitle(event),
                            event,
                            new Date(),
                            {
                                importance: 0.5,
                                description: event
                            }
                        );
                        
                        return `Added timeline event for ${character}: ${event}`;
                    } catch (error) {
                        return `Failed to add timeline event: ${error.message}`;
                    }
                    
                case 'view':
                    if (!character) {
                        return 'Usage: /lcws-timeline view [character]';
                    }
                    
                    const viewChar = characterDatabase.findCharacterByName(character);
                    if (!viewChar) {
                        return `Character "${character}" not found`;
                    }
                    
                    const timeline = timelineManager.getCharacterTimeline(viewChar.id, { limit: 15 });
                    const analysis = timelineManager.getTimelineAnalysis(viewChar.id);
                    
                    let result = `=== ${character} 时间线 ===\n\n`;
                    result += `总事件数: ${analysis.totalEvents}\n`;
                    result += `高重要性事件: ${analysis.importanceDistribution.high}个\n\n`;
                    
                    if (timeline.length > 0) {
                        result += '最近事件:\n';
                        timeline.slice(0, 10).forEach(timelineEvent => {
                            const dateStr = new Date(timelineEvent.date).toLocaleDateString();
                            result += `${dateStr}: ${timelineEvent.title}\n`;
                        });
                    }
                    
                    return result;
                    
                case 'clear':
                    if (!character) {
                        return 'Usage: /lcws-timeline clear [character]';
                    }
                    
                    const clearChar = characterDatabase.findCharacterByName(character);
                    if (!clearChar) {
                        return `Character "${character}" not found`;
                    }
                    
                    const eventIds = timelineManager.characterEvents.get(clearChar.id) || [];
                    let clearedCount = 0;
                    
                    for (const eventId of eventIds) {
                        try {
                            await timelineManager.deleteTimelineEvent(eventId);
                            clearedCount++;
                        } catch (error) {
                            console.warn(`Failed to delete event ${eventId}:`, error);
                        }
                    }
                    
                    return `Cleared ${clearedCount} timeline events for ${character}`;
                    
                default:
                    return 'Invalid action. Use: add, view, or clear';
            }
        },
    }));
    
    // 世界书相关命令
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'lcws-worldbook-sync',
        helpString: 'Sync characters with worldbook.',
        callback: async () => {
            if (!context.extensionSettings[settingsKey].enabled) {
                return 'System is disabled';
            }
            
            try {
                let syncedCount = 0;
                let updatedCount = 0;
                
                for (const [characterId, character] of characterDatabase.characters) {
                    const existingEntry = document.querySelector(`[data-id="${characterId}"]`);
                    if (existingEntry) {
                        await worldBookManager.updateCharacterEntry(character);
                        updatedCount++;
                    } else {
                        await worldBookManager.createCharacterEntry(character);
                        syncedCount++;
                    }
                }
                
                await worldBookManager.updateIndexEntry();
                
                return `世界书同步完成：新增 ${syncedCount} 个条目，更新 ${updatedCount} 个条目`;
            } catch (error) {
                return `世界书同步失败: ${error.message}`;
            }
        },
    }));
    
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'lcws-worldbook-load',
        helpString: 'Load characters from worldbook.',
        callback: async () => {
            if (!context.extensionSettings[settingsKey].enabled) {
                return 'System is disabled';
            }
            
            try {
                const loadedCharacters = await worldBookManager.loadExistingCharacters();
                let addedCount = 0;
                
                loadedCharacters.forEach(character => {
                    if (!characterDatabase.characters.has(character.id)) {
                        characterDatabase.addCharacter(character);
                        addedCount++;
                    }
                });
                
                if (addedCount > 0) {
                    uiManager.updateStats();
                    await worldBookManager.updateIndexEntry();
                }
                
                return `从世界书加载了 ${addedCount} 个新人物`;
            } catch (error) {
                return `从世界书加载失败: ${error.message}`;
            }
        },
    }));
    
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'lcws-worldbook-clear',
        helpString: 'Clear all character entries from worldbook.',
        callback: async () => {
            if (!context.extensionSettings[settingsKey].enabled) {
                return 'System is disabled';
            }
            
            try {
                let deletedCount = 0;
                
                for (const characterId of characterDatabase.characters.keys()) {
                    await worldBookManager.deleteCharacterEntry(characterId);
                    deletedCount++;
                }
                
                await worldBookManager.deleteCharacterEntry(worldBookManager.indexEntryId);
                
                return `从世界书删除了 ${deletedCount} 个人物条目`;
            } catch (error) {
                return `世界书清理失败: ${error.message}`;
            }
        },
    }));
    
    // 性能监控命令
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'lcws-performance',
        helpString: 'Show performance metrics.',
        callback: () => {
            if (!context.extensionSettings[settingsKey].enabled) {
                return 'System is disabled';
            }
            
            const metrics = performanceMonitor.getMetrics();
            
            let report = '=== 性能监控报告 ===\n\n';
            report += `性能评分: ${metrics.performanceScore.toFixed(1)}/100\n`;
            report += `平均响应时间: ${metrics.averageResponseTime.toFixed(2)}ms\n`;
            report += `错误数量: ${metrics.errors}\n\n`;
            
            report += '操作统计:\n';
            report += `- 人物操作: ${metrics.characterOperations}\n`;
            report += `- 关系操作: ${metrics.relationshipOperations}\n`;
            report += `- 时间线操作: ${metrics.timelineOperations}\n`;
            report += `- AI调用: ${metrics.aiCalls}\n\n`;
            
            if (metrics.recentOperations.length > 0) {
                report += '最近操作:\n';
                metrics.recentOperations.forEach(op => {
                    report += `- ${op.type}: ${op.duration.toFixed(2)}ms\n`;
                });
            }
            
            return report;
        },
    }));
    
    // 错误日志命令
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'lcws-errors',
        helpString: 'Show error log and statistics.',
        callback: () => {
            if (!context.extensionSettings[settingsKey].enabled) {
                return 'System is disabled';
            }
            
            const errorStats = errorRecoveryManager.getErrorStats();
            
            let report = '=== 错误日志统计 ===\n\n';
            report += `总错误数: ${errorStats.totalErrors}\n`;
            report += `恢复成功率: ${((errorStats.recoveryRate || 0) * 100).toFixed(1)}%\n\n`;
            
            report += '错误类型分布:\n';
            Object.entries(errorStats.errorTypes).forEach(([type, count]) => {
                report += `- ${type}: ${count}次\n`;
            });
            
            if (errorStats.recentErrors.length > 0) {
                report += '\n最近错误:\n';
                errorStats.recentErrors.slice(-5).forEach(error => {
                    report += `- ${error.timestamp}: ${error.error.type} - ${error.error.message}\n`;
                });
            }
            
            return report;
        },
    }));
}

// 全局变量
const characters = characterDatabase.characters;
const characterIndex = [];
const activeEntries = new Set();
const interactionHistory = new Map();
let lastTriggerTime = 0;

// 监听消息发送
globalThis.LayeredCharacterWorldbookSystem_interceptMessageSend = function (message) {
    const settings = context.extensionSettings[settingsKey];
    if (!settings.enabled || !settings.autoGenerate) {
        return;
    }
    
    if (smartTriggerSystem.checkTrigger({ message })) {
        handleCharacterGeneration(message);
    }
    
    if (shouldShowIndex(message)) {
        handleIndexQuery();
    }
    
    if (settings.enableRelationshipNetwork && shouldHandleRelationship(message)) {
        handleRelationshipManagement(message);
    }
    
    if (settings.enableTimelineManagement && shouldHandleTimeline(message)) {
        handleTimelineManagement(message);
    }
    
    if (settings.enableGrowthSystem) {
        detectAndProcessGrowthEvents(message, { message });
    }
    
    updateInteractionHistory(message);
};

// 监听消息接收
globalThis.LayeredCharacterWorldbookSystem_interceptMessageReceived = function (message) {
    const settings = context.extensionSettings[settingsKey];
    if (!settings.enabled) {
        return;
    }
    
    // 处理AI回复中的人物信息
    // 可以在这里提取新的人物信息或更新现有人物信息
};

// 初始化扩展
(async function initExtension() {
    if (!context.extensionSettings[settingsKey]) {
        context.extensionSettings[settingsKey] = structuredClone(defaultSettings);
    }
    
    for (const key of Object.keys(defaultSettings)) {
        if (context.extensionSettings[settingsKey][key] === undefined) {
            context.extensionSettings[settingsKey][key] = defaultSettings[key];
        }
    }
    
    addSettings();
    addCommands();
    
    if (context.extensionSettings[settingsKey].enabled) {
        $(document).ready(async () => {
            // 初始化悬浮球UI
            floatingBallUI.updateContent();
            
            await initializeWorldBook();
            
            if (context.extensionSettings[settingsKey].enableGrowthSystem) {
                setupGrowthEventListeners();
            }
            
            setupWorldbookMonitoring();
            
            setInterval(() => {
                cleanupExpiredData();
            }, context.extensionSettings[settingsKey].cleanupInterval);
            
            setInterval(() => {
                saveData();
            }, 5 * 60 * 1000);
            
            loadData();
        });
    }
    
    console.log('✅ 分层人物世界书系统插件初始化完成');
})();
