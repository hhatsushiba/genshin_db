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
    selectedCharacterId: null
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
    renderStatus();
    initializeCharacterSelect();
    bindEvents();
    renderAll();
});

function cacheElements() {
    elements.characterSelect = document.getElementById("character-select");
    elements.currentLevel = document.getElementById("current-level");
    elements.targetLevel = document.getElementById("target-level");
    elements.dataStatus = document.getElementById("data-status");
    elements.summaryCards = document.getElementById("summary-cards");
    elements.selectionSummary = document.getElementById("selection-summary");
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
    const talentSettings = masterData.tarent_level_up_settings || [];
    const talentBookMap = createNameMap(masterData.TalentBookData, "TalentBookID");
    const enemyItemMap = createNameMap(masterData.EnemyItemData, "EnemyItemID");
    const weeklyBossMap = createNameMap(masterData.WeeklyBossData, "WeeklyBossID");

    const characters = characterData.map(character => {
        const talentSegments = talentSettings.map(setting => buildTalentSegment(
            setting,
            talentBookMap[character.TalentBookID],
            enemyItemMap[character.EnemyItemID],
            weeklyBossMap[character.WeeklyBossID]
        ));

        return {
            id: String(character.CharID),
            name: character.Name,
            levelCosts: [],
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

function renderStatus() {
    if (state.data.source === "demo") {
        elements.dataStatus.textContent = "デモデータ表示中";
        elements.dataStatus.classList.remove("is-ready");
        return;
    }
    if (state.data.source === "public/data.json") {
        elements.dataStatus.textContent = "public/data.json 読込済み";
        elements.dataStatus.classList.add("is-ready");
        return;
    }
    elements.dataStatus.textContent = "データ読込済み";
    elements.dataStatus.classList.add("is-ready");
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
}

function getSelectedCharacter() {
    return state.data.characters.find(character => character.id === state.selectedCharacterId) || null;
}

function syncControlsForCharacter() {
    const character = getSelectedCharacter();
    if (!character) {
        return;
    }

    const levelOptions = deriveMilestoneOptions(character.levelCosts, 1);
    setSelectOptions(elements.currentLevel, levelOptions, levelOptions[0]);
    setSelectOptions(elements.targetLevel, levelOptions, levelOptions[levelOptions.length - 1]);
    const hasLevelCosts = character.levelCosts.length > 0;
    elements.currentLevel.disabled = !hasLevelCosts;
    elements.targetLevel.disabled = !hasLevelCosts;

    const talentOptions = deriveMilestoneOptions(character.talentCosts.normal, 1);
    Object.values(elements.talents).forEach(pair => {
        setSelectOptions(pair.current, talentOptions, talentOptions[0]);
        setSelectOptions(pair.target, talentOptions, talentOptions[talentOptions.length - 1]);
    });

    normalizeRanges();
}

function deriveMilestoneOptions(segments, fallbackStart) {
    const values = new Set([fallbackStart]);
    segments.forEach(segment => {
        values.add(segment.from);
        values.add(segment.to);
    });
    return [...values].sort((left, right) => left - right);
}

function setSelectOptions(select, options, selectedValue) {
    select.innerHTML = options.map(option => `<option value="${option}">${option}</option>`).join("");
    select.value = String(selectedValue);
}

function normalizeRanges() {
    normalizePair(elements.currentLevel, elements.targetLevel);
    normalizePair(elements.talents.normal.current, elements.talents.normal.target);
    normalizePair(elements.talents.skill.current, elements.talents.skill.target);
    normalizePair(elements.talents.burst.current, elements.talents.burst.target);
}

function normalizePair(currentSelect, targetSelect) {
    const currentValue = Number(currentSelect.value);
    const targetValue = Number(targetSelect.value);
    if (currentValue > targetValue) {
        targetSelect.value = currentSelect.value;
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
    renderMaterials(calculation.materials);
}

function calculateForCharacter(character) {
    const levelTotals = sumSegments(character.levelCosts, Number(elements.currentLevel.value), Number(elements.targetLevel.value));
    const normalTotals = sumSegments(character.talentCosts.normal, Number(elements.talents.normal.current.value), Number(elements.talents.normal.target.value));
    const skillTotals = sumSegments(character.talentCosts.skill, Number(elements.talents.skill.current.value), Number(elements.talents.skill.target.value));
    const burstTotals = sumSegments(character.talentCosts.burst, Number(elements.talents.burst.current.value), Number(elements.talents.burst.target.value));

    const total = mergeTotals(levelTotals, normalTotals, skillTotals, burstTotals);

    return {
        totals: total,
        materials: flattenMaterials(total.materials)
    };
}

function sumSegments(segments, currentValue, targetValue) {
    const activeSegments = segments.filter(segment => segment.from >= currentValue && segment.to <= targetValue);
    return activeSegments.reduce((accumulator, segment) => {
        accumulator.mora += Number(segment.mora || 0);
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
        return accumulator;
    }, { mora: 0, exp: 0, materials: {} });
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
    const grouped = summarizeGroups(calculation.materials);
    const cards = [
        { label: "必要モラ", value: formatNumber(calculation.totals.mora) },
        { label: "天賦本合計", value: formatNumber(grouped.book || 0) },
        { label: "素材種類数", value: formatNumber(calculation.materials.length) },
        { label: "週ボス / 冠", value: `${formatNumber(grouped.weekly || 0)} / ${formatNumber(grouped.crown || 0)}` }
    ];

    elements.summaryCards.innerHTML = cards.map(card => `
        <article class="summary-card">
            <span class="label">${card.label}</span>
            <span class="value">${card.value}</span>
        </article>
    `).join("");

    elements.selectionSummary.innerHTML = `
        <strong>${character.name}</strong><br>
        通常 ${elements.talents.normal.current.value} → ${elements.talents.normal.target.value} /
        スキル ${elements.talents.skill.current.value} → ${elements.talents.skill.target.value} /
        爆発 ${elements.talents.burst.current.value} → ${elements.talents.burst.target.value}${character.levelCosts.length === 0 ? "<br>レベル育成データは未連携のため、天賦素材のみ集計しています。" : ""}
    `;
}

function summarizeGroups(materials) {
    return materials.reduce((accumulator, material) => {
        accumulator[material.group] = (accumulator[material.group] || 0) + material.amount;
        return accumulator;
    }, {});
}

function renderMaterials(materials) {
    if (materials.length === 0) {
        elements.materialsTable.innerHTML = '<div class="empty-note">現在値と目標値が同じため、追加で必要な素材はありません。</div>';
        return;
    }

    elements.materialsTable.innerHTML = materials.map(material => `
        <div class="material-row">
            <div class="material-group">${groupLabels[material.group] || material.group}</div>
            <div class="material-name">${material.name}${material.note ? `<span class="material-note">${material.note}</span>` : ""}</div>
            <div class="material-count">${formatNumber(material.amount)}</div>
        </div>
    `).join("");
}

function renderEmptyState() {
    elements.characterSelect.innerHTML = '<option value="">キャラクターデータなし</option>';
    elements.currentLevel.innerHTML = '<option value="1">-</option>';
    elements.targetLevel.innerHTML = '<option value="1">-</option>';
    elements.currentLevel.disabled = true;
    elements.targetLevel.disabled = true;
    Object.values(elements.talents).forEach(pair => {
        pair.current.innerHTML = '<option value="1">-</option>';
        pair.target.innerHTML = '<option value="1">-</option>';
        pair.current.disabled = true;
        pair.target.disabled = true;
    });
    elements.dataStatus.textContent = "利用可能な計算データなし";
    elements.dataStatus.classList.remove("is-ready");
    elements.summaryCards.innerHTML = `
        <article class="summary-card">
            <span class="label">必要モラ</span>
            <span class="value">0</span>
        </article>
        <article class="summary-card">
            <span class="label">天賦本合計</span>
            <span class="value">0</span>
        </article>
        <article class="summary-card">
            <span class="label">素材種類数</span>
            <span class="value">0</span>
        </article>
        <article class="summary-card">
            <span class="label">週ボス / 冠</span>
            <span class="value">0 / 0</span>
        </article>
    `;
    elements.selectionSummary.innerHTML = "計算に使うキャラクターデータがまだありません。public/data.json の読み込み内容を確認してください。";
    elements.materialsTable.innerHTML = '<div class="empty-note">表示できる素材データがありません。</div>';
}

function formatNumber(value) {
    return new Intl.NumberFormat("ja-JP").format(Number(value || 0));
}