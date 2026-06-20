/**
 * グローバル変数
 */
let allCharacterData = [];
let allMaps = {};
let selectedFilters = { elements: [], weapons: [], bossItems: [], enemyItems: [], specialties: [], talentBooks: [], weeklyBosses: [] };

/**
 * 配列データを元に、指定したIDキーをプロパティ名とした名称マッピングオブジェクトを生成
 */
const createMap = (arr, idKey) => {
    if (!arr) return {};
    return arr.reduce((acc, current) => {
        acc[current[idKey]] = current.name;
        return acc;
    }, {});
};

/**
 * テーブルを再描画
 */
function renderTable(characterList) {
    const tbody = document.querySelector("#character-table tbody");
    tbody.innerHTML = "";
    const { elementMap, weaponMap, bossItemMap, enemyItemMap, specialtyMap, talentBookMap, weeklyBossMap } = allMaps;
    
    characterList.forEach(char => {
        const tr = document.createElement("tr");
        const elementName = elementMap[char.ElementID] || "-";
        const weaponName = weaponMap[char.WeaponTypeID] || "-";
        const bossItemName = bossItemMap[char.BossItemID] || "-";
        const enemyItemName = enemyItemMap[char.EnemyItemID] || "-";
        const specialtyName = specialtyMap[char.SpecialtyProductID] || "-";
        const talentBookName = talentBookMap[char.TalentBookID] || "-";
        const weeklyBossName = weeklyBossMap[char.WeeklyBossID] || "-";
        
        tr.innerHTML = `
            <td>${char.CharID}</td>
            <td><strong>${char.Name}</strong></td>
            <td><span class="element-badge elem-${char.ElementID}">${elementName}</span></td>
            <td>${weaponName}</td>
            <td>${bossItemName}</td>
            <td>${enemyItemName}</td>
            <td>${specialtyName}</td>
            <td>${talentBookName}</td>
            <td>${weeklyBossName}</td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * フィルター初期化
 */
function initializeFilters(data) {
    const elementFiltersDiv = document.getElementById("element-filters");
    const weaponFiltersDiv = document.getElementById("weapon-filters");
    if (!elementFiltersDiv || !weaponFiltersDiv) return;
    elementFiltersDiv.innerHTML = "";
    weaponFiltersDiv.innerHTML = "";

    data.ElementData.forEach(element => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `filter-toggle elem-${element.ElementID}`;
        btn.dataset.type = "element";
        btn.dataset.value = String(element.ElementID);
        btn.textContent = element.name;
        btn.addEventListener("click", () => {
            const val = btn.dataset.value;
            const idx = selectedFilters.elements.indexOf(val);
            if (idx === -1) selectedFilters.elements.push(val);
            else selectedFilters.elements.splice(idx, 1);
            btn.classList.toggle("active");
            applyFilters();
        });
        elementFiltersDiv.appendChild(btn);
    });

    data.WeaponTypeData.forEach(weapon => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "filter-toggle";
        btn.dataset.type = "weapon";
        btn.dataset.value = String(weapon.WeaponTypeID);
        btn.textContent = weapon.name;
        btn.addEventListener("click", () => {
            const val = btn.dataset.value;
            const idx = selectedFilters.weapons.indexOf(val);
            if (idx === -1) selectedFilters.weapons.push(val);
            else selectedFilters.weapons.splice(idx, 1);
            btn.classList.toggle("active");
            applyFilters();
        });
        weaponFiltersDiv.appendChild(btn);
    });
}

/**
 * モーダル内フィルタを初期化
 */
function initializeModalFilters(data) {
    const bossDiv = document.getElementById('boss-filters');
    const enemyDiv = document.getElementById('enemy-filters');
    const specialtyDiv = document.getElementById('specialty-filters');
    const talentDiv = document.getElementById('talent-filters');
    const weeklyDiv = document.getElementById('weekly-filters');
    if (!bossDiv) return;

    bossDiv.innerHTML = '';
    enemyDiv.innerHTML = '';
    specialtyDiv.innerHTML = '';
    talentDiv.innerHTML = '';
    weeklyDiv.innerHTML = '';

    (data.BossItemData || []).forEach(item => {
        const id = `boss-${item.BossItemID}`;
        const wrap = document.createElement('label');
        wrap.className = 'filter-checkbox';
        wrap.innerHTML = `<input type="checkbox" id="${id}" data-type="boss" value="${item.BossItemID}"><span>${item.name}</span>`;
        bossDiv.appendChild(wrap);
    });

    (data.EnemyItemData || []).forEach(item => {
        const id = `enemy-${item.EnemyItemID}`;
        const wrap = document.createElement('label');
        wrap.className = 'filter-checkbox';
        wrap.innerHTML = `<input type="checkbox" id="${id}" data-type="enemy" value="${item.EnemyItemID}"><span>${item.name}</span>`;
        enemyDiv.appendChild(wrap);
    });

    (data.SpecialtyProductData || []).forEach(item => {
        const id = `spec-${item.SpecialtyProductID}`;
        const wrap = document.createElement('label');
        wrap.className = 'filter-checkbox';
        wrap.innerHTML = `<input type="checkbox" id="${id}" data-type="specialty" value="${item.SpecialtyProductID}"><span>${item.name}</span>`;
        specialtyDiv.appendChild(wrap);
    });

    (data.TalentBookData || []).forEach(item => {
        const id = `talent-${item.TalentBookID}`;
        const wrap = document.createElement('label');
        wrap.className = 'filter-checkbox';
        wrap.innerHTML = `<input type="checkbox" id="${id}" data-type="talent" value="${item.TalentBookID}"><span>${item.name}</span>`;
        talentDiv.appendChild(wrap);
    });

    (data.WeeklyBossData || []).forEach(item => {
        const id = `weekly-${item.WeeklyBossID}`;
        const wrap = document.createElement('label');
        wrap.className = 'filter-checkbox';
        wrap.innerHTML = `<input type="checkbox" id="${id}" data-type="weekly" value="${item.WeeklyBossID}"><span>${item.name}</span>`;
        weeklyDiv.appendChild(wrap);
    });
}

/**
 * モーダル制御
 */
function openModal() {
    const modal = document.getElementById("filter-modal");
    const overlay = document.getElementById("modal-overlay");
    if (modal) modal.style.display = 'block';
    if (overlay) overlay.style.display = 'block';
}

function closeModal() {
    const modal = document.getElementById("filter-modal");
    const overlay = document.getElementById("modal-overlay");
    if (modal) modal.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
}

function resetFilters() {
    selectedFilters = { elements: [], weapons: [] };
    selectedFilters = { elements: [], weapons: [], bossItems: [], enemyItems: [], specialties: [], talentBooks: [], weeklyBosses: [] };
    document.querySelectorAll('.filter-toggle').forEach(btn => btn.classList.remove('active'));
    // clear modal checkboxes
    document.querySelectorAll('#filter-modal input[type="checkbox"]').forEach(cb => cb.checked = false);
    renderTable(allCharacterData);
}

function applyFilters() {
    let filteredData = allCharacterData;

    if (selectedFilters.elements.length > 0) {
        filteredData = filteredData.filter(char => selectedFilters.elements.includes(String(char.ElementID)));
    }

    if (selectedFilters.weapons.length > 0) {
        filteredData = filteredData.filter(char => selectedFilters.weapons.includes(String(char.WeaponTypeID)));
    }

    // modal-based filters
    if (selectedFilters.bossItems && selectedFilters.bossItems.length > 0) {
        filteredData = filteredData.filter(char => selectedFilters.bossItems.includes(String(char.BossItemID)));
    }
    if (selectedFilters.enemyItems && selectedFilters.enemyItems.length > 0) {
        filteredData = filteredData.filter(char => selectedFilters.enemyItems.includes(String(char.EnemyItemID)));
    }
    if (selectedFilters.specialties && selectedFilters.specialties.length > 0) {
        filteredData = filteredData.filter(char => selectedFilters.specialties.includes(String(char.SpecialtyProductID)));
    }
    if (selectedFilters.talentBooks && selectedFilters.talentBooks.length > 0) {
        filteredData = filteredData.filter(char => selectedFilters.talentBooks.includes(String(char.TalentBookID)));
    }
    if (selectedFilters.weeklyBosses && selectedFilters.weeklyBosses.length > 0) {
        filteredData = filteredData.filter(char => selectedFilters.weeklyBosses.includes(String(char.WeeklyBossID)));
    }

    renderTable(filteredData);
}

/** 表示モードを切り替える（'all'|'break'|'talent'） */
function setDisplayMode(mode) {
    const tableWrap = document.getElementById('table-wrap');
    if (!tableWrap) return;
    tableWrap.classList.remove('mode-all', 'mode-break', 'mode-talent');
    tableWrap.classList.add('mode-' + mode);
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
}

/**
 * データ読み込み
 */
async function loadCharacterData() {
    const statusEl = document.getElementById("status");
    const tableWrapEl = document.getElementById("table-wrap");
    
    try {
        const response = await fetch("data.json");
        if (!response.ok) throw new Error(`HTTPエラー! ステータス: ${response.status}`);
        
        const data = await response.json();
        const elementMap = createMap(data.ElementData, "ElementID");
        const weaponMap = createMap(data.WeaponTypeData, "WeaponTypeID");
        const bossItemMap = createMap(data.BossItemData, "BossItemID");
        const enemyItemMap = createMap(data.EnemyItemData, "EnemyItemID");
        const specialtyMap = createMap(data.SpecialtyProductData, "SpecialtyProductID");
        const talentBookMap = createMap(data.TalentBookData, "TalentBookID");
        const weeklyBossMap = createMap(data.WeeklyBossData, "WeeklyBossID");
        
        allCharacterData = data.CharacterData || [];
        allMaps = { elementMap, weaponMap, bossItemMap, enemyItemMap, specialtyMap, talentBookMap, weeklyBossMap };
        
        if (allCharacterData.length === 0) {
            statusEl.textContent = "キャラクターデータが見つかりませんでした。";
            return;
        }
        
        renderTable(allCharacterData);
        initializeFilters(data);
        initializeModalFilters(data);
        statusEl.style.display = "none";
        tableWrapEl.style.display = "block";
    } catch (error) {
        console.error("エラーが発生しました:", error);
        statusEl.textContent = "データの読み込みに失敗しました。data.json が正しい場所にあるか、またはローカルサーバー経由で開いているか確認してください。";
        statusEl.classList.add("error");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadCharacterData();
    // タイトルをダブルクリックでフィルターをリセット (便利機能)
    const title = document.querySelector('h1');
    if (title) title.addEventListener('dblclick', resetFilters);
    // advanced filter button
    const advBtn = document.getElementById('advanced-filter-btn');
    if (advBtn) advBtn.addEventListener('click', openModal);
    const closeModalBtn = document.getElementById('close-modal');
    const modalOverlay = document.getElementById('modal-overlay');
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (modalOverlay) modalOverlay.addEventListener('click', closeModal);
    // tab switching
    document.addEventListener('click', (e) => {
        const t = e.target;
        if (t.classList && t.classList.contains('tab-btn')) {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            t.classList.add('active');
            const target = t.dataset.target;
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            const panel = document.getElementById(target);
            if (panel) panel.classList.add('active');
        }
    });
    // apply/reset buttons in modal
    const applyBtn = document.getElementById('apply-filters');
    const resetBtn = document.getElementById('reset-filters');
    if (applyBtn) applyBtn.addEventListener('click', () => {
        // collect checked values
        selectedFilters.bossItems = Array.from(document.querySelectorAll('#boss-filters input[type="checkbox"]:checked')).map(cb => cb.value);
        selectedFilters.enemyItems = Array.from(document.querySelectorAll('#enemy-filters input[type="checkbox"]:checked')).map(cb => cb.value);
        selectedFilters.specialties = Array.from(document.querySelectorAll('#specialty-filters input[type="checkbox"]:checked')).map(cb => cb.value);
        selectedFilters.talentBooks = Array.from(document.querySelectorAll('#talent-filters input[type="checkbox"]:checked')).map(cb => cb.value);
        selectedFilters.weeklyBosses = Array.from(document.querySelectorAll('#weekly-filters input[type="checkbox"]:checked')).map(cb => cb.value);
        applyFilters();
        closeModal();
    });
    if (resetBtn) resetBtn.addEventListener('click', resetFilters);
    // display mode buttons
    document.querySelectorAll('.mode-btn').forEach(btn => btn.addEventListener('click', () => setDisplayMode(btn.dataset.mode)));
    // set default mode
    setDisplayMode('all');
});
