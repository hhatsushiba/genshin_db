const demoData = {
    source: "demo",
    characters: []
};

const groupLabels = {
    gem: "宝石",
    boss: "ボス",
    enemy: "敵素材",
    specialty: "特産品",
    book: "天賦本",
    weekly: "週ボス",
    crown: "冠",
    "exp-book": "経験値本",
    currency: "通貨"
};

const state = {
    data: null,
    selectedCharacterId: null,
    searchMode: "all"
};

const elements = {};

const itemClassLabels = {
    beginner: {
        book: "教え",
        enemy: "初級",
        order: 1
    },
    intermediate: {
        book: "導き",
        enemy: "中級",
        order: 2
    },
    advanced: {
        book: "哲学",
        enemy: "上級",
        order: 3
    }
};

document.addEventListener("DOMContentLoaded", async () => {
    cacheElements();
    state.data = await resolveData();
    initializeCharacterSelect();
    bindEvents();
    renderAll();
});

function cacheElements() {
    elements.characterSelect = document.getElementById("character-select");
    elements.currentLevel = document.getElementById("current-level");
    elements.targetLevel = document.getElementById("target-level");
    elements.modeLevel = document.getElementById("mode-level");
    elements.modeTalent = document.getElementById("mode-talent");
    elements.dataStatus = document.getElementById("data-status");
    elements.materialsTable = document.getElementById("materials-table");
    elements.talents = {
        normal: {
            current: document.getElementById("talent-normal-current"),
            target: document.getElementById("talent-normal-target")
        },
        skill: {
            current: document.getElementById("talent-skill-current"),
            target: document.getElementById("talent-skill-target")
        },
        burst: {
            current: document.getElementById("talent-burst-current"),
            target: document.getElementById("talent-burst-target")
        }
    };
}

async function resolveData() {
    const externalData = window.GENSHIN_CALCULATOR_DATA;
    if (externalData && Array.isArray(externalData.characters) && externalData.characters.length > 0) {
        return { ...externalData, source: externalData.source || "external" };
    }

    try {
        const response = await fetch("public/data.json");
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const masterData = await response.json();
        return buildCalculatorDataFromMaster(masterData);
    } catch (error) {
        console.error("育成計算用データの読み込みに失敗しました:", error);
    }

    return demoData;
}

function buildCalculatorDataFromMaster(masterData) {
    const characterData = masterData.CharacterData || [];
    const levelUpSettings = masterData.characterLevelUpData || [];
    const ascensionSettings = masterData.AscensionLevelData || [];
    const talentSettings = masterData.talentLevelUpData || masterData.tarent_level_up_settings || [];
    const talentBookMap = createNameMap(masterData.TalentBookData, "TalentBookID");
    const enemyItemMap = createNameMap(masterData.EnemyItemData, "EnemyItemID");
    const weeklyBossMap = createNameMap(masterData.WeeklyBossData, "WeeklyBossID");
    const bossItemMap = createNameMap(masterData.BossItemData, "BossItemID");
    const specialtyProductMap = createNameMap(masterData.SpecialtyProductData, "SpecialtyProductID");
    const elementMap = createNameMap(masterData.ElementData, "ElementID");

    const sortedLevelSettings = [...levelUpSettings].sort((left, right) => Number(left.current_level) - Number(right.current_level));
    const ascensionByLevel = new Map((ascensionSettings || []).map(setting => [Number(setting.current_level), setting]));

    const characters = characterData.map(character => {
        const levelSegments = buildLevelSegments(
            sortedLevelSettings,
            ascensionByLevel,
            elementMap[character.ElementID],
            bossItemMap[character.BossItemID],
            specialtyProductMap[character.SpecialtyProductID],
            enemyItemMap[character.EnemyItemID]
        );
        const levelProgress = buildLevelProgress(levelSegments);
        const talentSegments = talentSettings.map(setting => buildTalentSegment(
            setting,
            talentBookMap[character.TalentBookID],
            enemyItemMap[character.EnemyItemID],
            weeklyBossMap[character.WeeklyBossID]
        ));

        return {
            id: String(character.CharID),
            name: character.Name,
            levelCosts: levelSegments,
            levelProgress,
            talentCosts: {
                normal: talentSegments,
                skill: cloneSegments(talentSegments),
                burst: cloneSegments(talentSegments)
            }
        };
    });

    return {
        source: "public/data.json",
        characters
    };
}

function createNameMap(items, idKey) {
    return (items || []).reduce((accumulator, item) => {
        accumulator[String(item[idKey])] = item.name;
        return accumulator;
    }, {});
}

function buildLevelProgress(levelSegments) {
    const runningTotals = createTotals();
    const states = [];

    states.push(createLevelState(1, false, runningTotals));

    levelSegments.forEach(segment => {
        if (segment.breakthroughMora || (segment.breakthroughMaterials || []).length > 0) {
            addLevelCosts(runningTotals, segment.breakthroughMora, 0, segment.breakthroughMaterials);
            states.push(createLevelState(segment.from, true, runningTotals));
        }

        addLevelCosts(runningTotals, segment.levelMora, segment.exp, segment.materials);
        states.push(createLevelState(segment.to, false, runningTotals));
    });

    return { states, totalsByKey: states.reduce((accumulator, state) => {
        accumulator[state.key] = state.totals;
        return accumulator;
    }, {}), keys: states.map(state => state.key) };
}

function createTotals() {
    return { mora: 0, exp: 0, materials: {} };
}

function createLevelState(level, includeBreakthrough, totals) {
    return {
        key: makeLevelOptionValue(level, includeBreakthrough),
        level,
        includeBreakthrough,
        label: includeBreakthrough ? `${level}(突破済み)` : String(level),
        totals: cloneTotals(totals)
    };
}

function cloneTotals(totals) {
    return {
        mora: Number(totals.mora || 0),
        exp: Number(totals.exp || 0),
        materials: Object.fromEntries(Object.entries(totals.materials || {}).map(([key, material]) => [key, { ...material }]))
    };
}

function addLevelCosts(targetTotals, mora, exp, materials) {
    targetTotals.mora += Number(mora || 0);
    targetTotals.exp += Number(exp || 0);
    (materials || []).forEach(material => {
        const key = material.key || material.name;
        if (!targetTotals.materials[key]) {
            targetTotals.materials[key] = {
                key,
                name: material.name,
                group: material.group || "other",
                note: material.note || "",
                sortOrder: material.sortOrder || 99,
                amount: 0
            };
        }
        targetTotals.materials[key].amount += Number(material.amount || 0);
    });
}

function buildLevelSegments(levelSettings, ascensionByLevel, elementName, bossItemName, specialtyProductName, enemyItemName) {
    return (levelSettings || []).map((setting, index, settings) => {
        const currentLevel = Number(setting.current_level);
        const nextLevel = Number(settings[index + 1]?.current_level || 90);
        const levelRequirements = setting.required_items?.[0] || {};
        const ascensionRequirements = ascensionByLevel.get(currentLevel)?.required_items?.[0] || {};
        const levelMaterials = [];
        const breakthroughMaterials = [];

        if (levelRequirements.experience_book_quantity) {
            levelMaterials.push({
                key: "exp-book",
                name: "経験値本",
                group: "exp-book",
                sortOrder: 0,
                amount: Number(levelRequirements.experience_book_quantity)
            });
        }

        appendAscensionMaterials(breakthroughMaterials, ascensionRequirements, elementName, bossItemName, specialtyProductName, enemyItemName);

        return {
            from: currentLevel,
            to: nextLevel,
            levelMora: Number(levelRequirements.mora || 0),
            breakthroughMora: Number(ascensionRequirements.mora || 0),
            exp: Number(levelRequirements.experience_book_quantity || 0),
            materials: levelMaterials,
            breakthroughMaterials
        };
    });
}

function appendAscensionMaterials(materials, ascensionRequirements, elementName, bossItemName, specialtyProductName, enemyItemName) {
    const gemstone = ascensionRequirements.gemstone?.[0];
    if (gemstone?.quantity) {
        const itemClass = normalizeGemClass(gemstone.item_class);
        materials.push({
            key: `gem-${itemClass}`,
            name: buildGemstoneName(elementName, itemClass),
            group: "gem",
            sortOrder: 0,
            amount: Number(gemstone.quantity)
        });
    }

    const bossItem = ascensionRequirements.boss_item?.[0];
    if (bossItem?.quantity) {
        materials.push({
            key: "boss-item",
            name: bossItemName || "ボス素材",
            group: "boss",
            sortOrder: 1,
            amount: Number(bossItem.quantity)
        });
    }

    const specialtyItem = ascensionRequirements.specialty_item?.[0];
    if (specialtyItem?.quantity) {
        materials.push({
            key: "specialty-item",
            name: specialtyProductName || "特産品",
            group: "specialty",
            sortOrder: 2,
            amount: Number(specialtyItem.quantity)
        });
    }

    const enemyItem = ascensionRequirements.enemy_item?.[0];
    if (enemyItem?.quantity) {
        const itemClass = itemClassLabels[enemyItem.item_class] || { enemy: "素材", order: 99 };
        materials.push({
            key: `enemy-${enemyItem.item_class}`,
            name: `敵素材（${itemClass.enemy}）`,
            group: "enemy",
            sortOrder: itemClass.order || 99,
            amount: Number(enemyItem.quantity),
            note: enemyItemName ? `系統: ${enemyItemName}` : "系統不明"
        });
    }
}

function normalizeGemClass(itemClass) {
    return itemClass === "chenk" ? "chunk" : itemClass;
}

function buildGemstoneName(elementName, itemClass) {
    const classLabels = {
        sliver: "砕屑",
        fragment: "欠片",
        chunk: "塊",
        gemstone: "宝石"
    };
    const label = classLabels[itemClass] || "素材";
    return `${elementName || "元素"}の${label}`;
}

function buildTalentSegment(setting, talentBookName, enemyItemName, weeklyBossName) {
    const currentLevel = Number(setting.current_level);
    const requiredItems = setting.required_items?.[0] || {};
    const itemClass = itemClassLabels[requiredItems.item_class] || { book: "素材", enemy: "素材" };
    const itemOrder = itemClass.order || 99;
    const materials = [];

    if (requiredItems.book_quantity) {
        materials.push({
            key: `book-${requiredItems.item_class}`,
            name: `「${talentBookName || "不明"}」の${itemClass.book}`,
            group: "book",
            sortOrder: itemOrder,
            amount: Number(requiredItems.book_quantity)
        });
    }

    if (requiredItems.enemy_item_quantity) {
        materials.push({
            key: `enemy-${requiredItems.item_class}`,
            name: `敵素材（${itemClass.enemy}）`,
            group: "enemy",
            sortOrder: itemOrder,
            amount: Number(requiredItems.enemy_item_quantity),
            note: enemyItemName ? `系統: ${enemyItemName}` : "系統不明"
        });
    }

    if (requiredItems.weekly_boss_item_quantity) {
        materials.push({
            key: "weekly-boss",
            name: "週ボス素材",
            group: "weekly",
            sortOrder: itemOrder,
            amount: Number(requiredItems.weekly_boss_item_quantity),
            note: weeklyBossName ? `入手先: ${weeklyBossName}` : "入手先不明"
        });
    }

    if (requiredItems.crown_quantity) {
        materials.push({
            key: "crown",
            name: "知恵の冠",
            group: "crown",
            sortOrder: itemOrder,
            amount: Number(requiredItems.crown_quantity)
        });
    }

    return {
        from: currentLevel,
        to: currentLevel + 1,
        mora: Number(requiredItems.mora || 0),
        materials
    };
}

function cloneSegments(segments) {
    return JSON.parse(JSON.stringify(segments));
}

function initializeCharacterSelect() {
    if (!state.data.characters.length) {
        renderEmptyState();
        return;
    }

    const options = state.data.characters.map(character => `
        <option value="${character.id}">${character.name}</option>
    `).join("");
    elements.characterSelect.innerHTML = options;
    state.selectedCharacterId = state.data.characters[0]?.id || null;
    elements.characterSelect.value = state.selectedCharacterId;
    syncControlsForCharacter();
}

function bindEvents() {
    elements.characterSelect.addEventListener("change", () => {
        state.selectedCharacterId = elements.characterSelect.value;
        syncControlsForCharacter();
        renderAll();
    });

    [
        elements.currentLevel,
        elements.targetLevel,
        elements.talents.normal.current,
        elements.talents.normal.target,
        elements.talents.skill.current,
        elements.talents.skill.target,
        elements.talents.burst.current,
        elements.talents.burst.target
    ].forEach(control => {
        control.addEventListener("change", () => {
            normalizeRanges();
            renderAll();
        });
    });

    elements.modeLevel.addEventListener("click", () => {
        setSearchMode(state.searchMode === "level" ? "all" : "level");
    });

    elements.modeTalent.addEventListener("click", () => {
        setSearchMode(state.searchMode === "talent" ? "all" : "talent");
    });
}

function getSelectedCharacter() {
    return state.data.characters.find(character => character.id === state.selectedCharacterId) || null;
}

function syncControlsForCharacter() {
    const character = getSelectedCharacter();
    if (!character) {
        return;
    }

    const levelOptions = deriveLevelStateOptions(character.levelProgress);
    setSelectOptions(elements.currentLevel, levelOptions, levelOptions[0]);
    setSelectOptions(elements.targetLevel, levelOptions, levelOptions[levelOptions.length - 1]);
    const hasLevelCosts = levelOptions.length > 0;
    elements.currentLevel.disabled = !hasLevelCosts;
    elements.targetLevel.disabled = !hasLevelCosts;

    const talentOptions = deriveMilestoneOptions(character.talentCosts.normal, 1);
    Object.values(elements.talents).forEach(pair => {
        setSelectOptions(pair.current, talentOptions, talentOptions[0]);
        setSelectOptions(pair.target, talentOptions, talentOptions[talentOptions.length - 1]);
    });

    applySearchModeConstraints();
    normalizeRanges();
}

function deriveLevelStateOptions(levelProgress) {
    return (levelProgress?.states || []).map(state => ({
        value: state.key,
        label: state.label
    }));
}

function deriveMilestoneOptions(segments, fallbackStart) {
    const values = new Set([fallbackStart]);
    (segments || []).forEach(segment => {
        values.add(segment.from);
        values.add(segment.to);
    });
    return [...values].sort((left, right) => left - right);
}

function makeLevelOptionValue(level, includeBreakthrough) {
    return `${level}|${includeBreakthrough ? "b" : "n"}`;
}

function parseLevelOptionValue(value) {
    const [levelPart, breakthroughPart] = String(value).split("|");
    return {
        level: Number(levelPart || 0),
        includeBreakthrough: breakthroughPart === "b"
    };
}

function setSelectOptions(select, options, selectedValue) {
    select.innerHTML = options.map(option => {
        if (typeof option === "object") {
            return `<option value="${option.value}">${option.label}</option>`;
        }
        return `<option value="${option}">${option}</option>`;
    }).join("");
    select.value = typeof selectedValue === "object" ? String(selectedValue.value) : String(selectedValue);
}

function normalizeRanges() {
    normalizePair(elements.currentLevel, elements.targetLevel);
    normalizePair(elements.talents.normal.current, elements.talents.normal.target);
    normalizePair(elements.talents.skill.current, elements.talents.skill.target);
    normalizePair(elements.talents.burst.current, elements.talents.burst.target);
}

function setSearchMode(mode) {
    state.searchMode = mode === "level" || mode === "talent" ? mode : "all";
    applySearchModeConstraints();
    renderAll();
}

function applySearchModeConstraints() {
    const isLevelMode = state.searchMode === "level";
    const isTalentMode = state.searchMode === "talent";

    if (elements.modeLevel) {
        elements.modeLevel.classList.toggle("is-active", isLevelMode);
    }
    if (elements.modeTalent) {
        elements.modeTalent.classList.toggle("is-active", isTalentMode);
    }

    if (isLevelMode) {
        setTalentLevelFixed(10);
        enableLevelControls(true);
    } else if (isTalentMode) {
        setCharacterLevelFixed(90);
        enableLevelControls(false);
        enableTalentControls(true);
    } else {
        enableLevelControls(true);
        enableTalentControls(true);
    }
}

function setTalentLevelFixed(level) {
    Object.values(elements.talents).forEach(pair => {
        pair.current.value = String(level);
        pair.target.value = String(level);
    });
    enableTalentControls(false);
}

function setCharacterLevelFixed(level) {
    elements.currentLevel.value = String(level);
    elements.targetLevel.value = makeLevelOptionValue(level, false);
    enableLevelControls(false);
}

function enableLevelControls(enabled) {
    elements.currentLevel.disabled = !enabled;
    elements.targetLevel.disabled = !enabled;
}

function enableTalentControls(enabled) {
    Object.values(elements.talents).forEach(pair => {
        pair.current.disabled = !enabled;
        pair.target.disabled = !enabled;
    });
}

function normalizePair(currentSelect, targetSelect) {
    if (currentSelect.selectedIndex > targetSelect.selectedIndex) {
        targetSelect.selectedIndex = currentSelect.selectedIndex;
    }
}

function renderAll() {
    const character = getSelectedCharacter();
    if (!character) {
        renderEmptyState();
        return;
    }

    const calculation = calculateForCharacter(character);
    renderSummary(character, calculation);
    renderMaterials(calculation.materials, calculation.totals.mora);
}

function calculateForCharacter(character) {
    const levelTotals = calculateLevelTotals(character.levelProgress, elements.currentLevel.value, elements.targetLevel.value);
    const normalTotals = sumSegments(character.talentCosts.normal, Number(elements.talents.normal.current.value), Number(elements.talents.normal.target.value));
    const skillTotals = sumSegments(character.talentCosts.skill, Number(elements.talents.skill.current.value), Number(elements.talents.skill.target.value));
    const burstTotals = sumSegments(character.talentCosts.burst, Number(elements.talents.burst.current.value), Number(elements.talents.burst.target.value));

    const total = mergeTotals(levelTotals, normalTotals, skillTotals, burstTotals);

    return {
        totals: total,
        materials: flattenMaterials(total.materials)
    };
}

function calculateLevelTotals(levelProgress, currentKey, targetKey) {
    const progress = levelProgress || { totalsByKey: {}, keys: [] };
    const currentIndex = progress.keys.indexOf(currentKey);
    const targetIndex = progress.keys.indexOf(targetKey);

    if (currentIndex < 0 || targetIndex < 0 || currentIndex >= targetIndex) {
        return createTotals();
    }

    const startTotals = progress.totalsByKey[currentKey] || createTotals();
    const endTotals = progress.totalsByKey[targetKey] || createTotals();
    return subtractTotals(endTotals, startTotals);
}

function sumSegments(segments, currentValue, targetSelection) {
    const targetValue = typeof targetSelection === "object" ? Number(targetSelection.level || 0) : Number(targetSelection);
    const includeBreakthrough = typeof targetSelection === "object" && targetSelection.includeBreakthrough;
    const activeSegments = segments.filter(segment => segment.from >= currentValue && segment.to <= targetValue);
    const total = activeSegments.reduce((accumulator, segment) => {
        accumulator.mora += Number(segment.levelMora ?? segment.mora ?? 0);
        accumulator.exp += Number(segment.exp || 0);
        (segment.materials || []).forEach(material => {
            const key = material.key || material.name;
            if (!accumulator.materials[key]) {
                accumulator.materials[key] = {
                    key,
                    name: material.name,
                    group: material.group || "other",
                    note: material.note || "",
                    sortOrder: material.sortOrder || 99,
                    amount: 0
                };
            }
            accumulator.materials[key].amount += Number(material.amount || 0);
        });
        if (includeBreakthrough) {
            accumulator.mora += Number(segment.breakthroughMora || 0);
            (segment.breakthroughMaterials || []).forEach(material => {
                const key = material.key || material.name;
                if (!accumulator.materials[key]) {
                    accumulator.materials[key] = {
                        key,
                        name: material.name,
                        group: material.group || "other",
                        note: material.note || "",
                        sortOrder: material.sortOrder || 99,
                        amount: 0
                    };
                }
                accumulator.materials[key].amount += Number(material.amount || 0);
            });
        }
        return accumulator;
    }, { mora: 0, exp: 0, materials: {} });

    if (includeBreakthrough) {
        const boundarySegment = segments.find(segment => Number(segment.from) === targetValue);
        if (boundarySegment) {
            total.mora += Number(boundarySegment.breakthroughMora || 0);
            (boundarySegment.breakthroughMaterials || []).forEach(material => {
                const key = material.key || material.name;
                if (!total.materials[key]) {
                    total.materials[key] = {
                        key,
                        name: material.name,
                        group: material.group || "other",
                        note: material.note || "",
                        sortOrder: material.sortOrder || 99,
                        amount: 0
                    };
                }
                total.materials[key].amount += Number(material.amount || 0);
            });
        }
    }

    return total;
}

function subtractTotals(left, right) {
    const materials = {};
    Object.entries(left.materials || {}).forEach(([key, material]) => {
        materials[key] = { ...material };
    });

    Object.entries(right.materials || {}).forEach(([key, material]) => {
        if (!materials[key]) {
            materials[key] = { ...material, amount: 0 };
        }
        materials[key].amount -= Number(material.amount || 0);
    });

    return {
        mora: Number(left.mora || 0) - Number(right.mora || 0),
        exp: Number(left.exp || 0) - Number(right.exp || 0),
        materials
    };
}

function mergeTotals(...totals) {
    return totals.reduce((accumulator, current) => {
        accumulator.mora += current.mora;
        accumulator.exp += current.exp;
        Object.values(current.materials).forEach(material => {
            if (!accumulator.materials[material.key]) {
                accumulator.materials[material.key] = { ...material };
                return;
            }
            accumulator.materials[material.key].amount += material.amount;
        });
        return accumulator;
    }, { mora: 0, exp: 0, materials: {} });
}

function flattenMaterials(materialMap) {
    return Object.values(materialMap).sort((left, right) => {
        const leftGroup = groupLabels[left.group] || left.group;
        const rightGroup = groupLabels[right.group] || right.group;
        if (leftGroup !== rightGroup) {
            return leftGroup.localeCompare(rightGroup, "ja");
        }
        if ((left.sortOrder || 99) !== (right.sortOrder || 99)) {
            return (left.sortOrder || 99) - (right.sortOrder || 99);
        }
        return left.name.localeCompare(right.name, "ja");
    });
}

function renderSummary(character, calculation) {
}

function renderMaterials(materials, totalMora) {
    const rows = [
        `
        <div class="material-row material-row-mora">
            <div class="material-group">モラ</div>
            <div class="material-name">必要モラ</div>
            <div class="material-count">${formatNumber(totalMora)}</div>
        </div>
        `,
        ...materials.map(material => `
        <div class="material-row">
            <div class="material-group">${groupLabels[material.group] || material.group}</div>
            <div class="material-name">${material.name}${material.note ? `<span class="material-note">${material.note}</span>` : ""}</div>
            <div class="material-count">${formatNumber(material.amount)}</div>
        </div>
    `)
    ];

    if (materials.length === 0) {
        rows.push('<div class="empty-note">追加で必要な素材はありません。</div>');
    }

    elements.materialsTable.innerHTML = rows.join("");
}

function renderEmptyState() {
    elements.characterSelect.innerHTML = '<option value="">キャラクターデータなし</option>';
    elements.currentLevel.innerHTML = '<option value="1">-</option>';
    elements.targetLevel.innerHTML = '<option value="1">-</option>';
    elements.currentLevel.disabled = true;
    elements.targetLevel.disabled = true;
    if (elements.modeLevel) {
        elements.modeLevel.disabled = true;
    }
    if (elements.modeTalent) {
        elements.modeTalent.disabled = true;
    }
    Object.values(elements.talents).forEach(pair => {
        pair.current.innerHTML = '<option value="1">-</option>';
        pair.target.innerHTML = '<option value="1">-</option>';
        pair.current.disabled = true;
        pair.target.disabled = true;
    });
    elements.dataStatus.textContent = "利用可能な計算データなし";
    elements.dataStatus.classList.remove("is-ready");
    elements.materialsTable.innerHTML = `
        <div class="material-row material-row-mora">
            <div class="material-group">モラ</div>
            <div class="material-name">必要モラ</div>
            <div class="material-count">0</div>
        </div>
        <div class="empty-note">表示できる素材データがありません。</div>
    `;
}

function formatNumber(value) {
    return new Intl.NumberFormat("ja-JP").format(Number(value || 0));
}