/**
 * 配列データを元に、指定したIDキーをプロパティ名とした名称マッピングオブジェクトを生成する関数
 */
const createMap = (arr, idKey) => {
    if (!arr) return {};
    return arr.reduce((acc, current) => {
        acc[current[idKey]] = current.name;
        return acc;
    }, {});
};

/**
 * 外部の data.json からデータを取得してテーブルを描画するメイン関数
 */
async function loadCharacterData() {
    const statusEl = document.getElementById('status');
    const tableWrapEl = document.getElementById('table-wrap');
    const tbody = document.querySelector('#character-table tbody');

    try {
        // 同じディレクトリにある data.json をフェッチ（取得）
        const response = await fetch('data.json');
        
        if (!response.ok) {
            throw new Error(`HTTPエラー! ステータス: ${response.status}`);
        }

        const data = await response.json();

        // 各マスターデータの ID -> 名称 マッピングオブジェクトを作成
        const elementMap = createMap(data.ElementData, 'ElementID');
        const weaponMap = createMap(data.WeaponTypeData, 'WeaponTypeID');
        const bossItemMap = createMap(data.BossItemData, 'BossItemID');
        const enemyItemMap = createMap(data.EnemyItemData, 'EnemyItemID');
        const specialtyMap = createMap(data.SpecialtyProductData, 'SpecialtyProductID');
        const talentBookMap = createMap(data.TalentBookData, 'TalentBookID');
        const weeklyBossMap = createMap(data.WeeklyBossData, 'WeeklyBossID');

        // キャラクターデータの配列を取得
        const characterList = data.CharacterData || [];

        if (characterList.length === 0) {
            statusEl.textContent = 'キャラクターデータが見つかりませんでした。';
            return;
        }

        // キャラクターごとにテーブルの行（tr）を組み立てる
        characterList.forEach(char => {
            const tr = document.createElement('tr');

            // IDを元にそれぞれのマッピングから名称を取り出す（存在しない場合はハイフン）
            const elementName = elementMap[char.ElementID] || '-';
            const weaponName = weaponMap[char.WeaponTypeID] || '-';
            const bossItemName = bossItemMap[char.BossItemID] || '-';
            const enemyItemName = enemyItemMap[char.EnemyItemID] || '-';
            const specialtyName = specialtyMap[char.SpecialtyProductID] || '-';
            const talentBookName = talentBookMap[char.TalentBookID] || '-';
            const weeklyBossName = weeklyBossMap[char.WeeklyBossID] || '-';

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

        // データの処理が成功したら、メッセージを非表示にしてテーブルを表示
        statusEl.style.display = 'none';
        tableWrapEl.style.display = 'block';

    } catch (error) {
        console.error('エラーが発生しました:', error);
        statusEl.textContent = 'データの読み込みに失敗しました。data.json が正しい場所にあるか、またはローカルサーバー経由で開いているか確認してください。';
        statusEl.classList.add('error');
    }
}

// HTMLの解析が終わったタイミングで実行開始
document.addEventListener('DOMContentLoaded', loadCharacterData);