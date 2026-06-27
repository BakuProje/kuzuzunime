/**
 * Utility helper untuk Sistem Level & EXP ZUNIME
 */

// Formula EXP untuk naik level berikutnya
// EXP = 100 + (Level * 50)
export function getExpNeededForLevel(level) {
  const lvl = parseInt(level) || 1;
  return 100 + (lvl * 50);
}

/**
 * Mendapatkan data level lengkap (Rank, Icon, Next Level EXP, dll)
 * @param {number} level - Level saat ini
 * @param {string} role - Role pengguna
 * @param {boolean} unlimitedExp - Apakah EXP tanpa batas
 */
export function getLevelData(level, role, unlimitedExp = false) {
  const isUnlimited = unlimitedExp || role === 'Teman' || role === 'Dewa';

  // Penanganan khusus untuk role Teman
  if (role === 'Teman') {
    return {
      level: '∞',
      rankName: 'Teman',
      icon: '/Icon exp/teman.jpg',
      isUnlimited: true,
      nextLevelExp: 0,
      percent: 100
    };
  }

  // Penanganan khusus untuk role Dewa
  if (role === 'Dewa') {
    return {
      level: '∞',
      rankName: 'Dewa',
      icon: '/Icon exp/dewa.jpg',
      isUnlimited: true,
      nextLevelExp: 0,
      percent: 100
    };
  }

  // Penanganan jika flag unlimited_exp di database bernilai true untuk user biasa (jika ada)
  if (isUnlimited) {
    return {
      level: '∞',
      rankName: role === 'Admin' ? 'Admin' : 'Dewa',
      icon: '/Icon exp/dewa.jpg',
      isUnlimited: true,
      nextLevelExp: 0,
      percent: 100
    };
  }

  const lvl = Math.max(1, parseInt(level) || 1);
  let rankName = 'Rookie Otaku';
  let icon = '/Icon exp/Rookie Otaku.jpg';

  if (lvl >= 10000) {
    rankName = '宇宙 Uchū';
    icon = '/Icon exp/Uchū.jpg';
  } else if (lvl >= 7501) {
    rankName = '神 Kami';
    icon = '/Icon exp/Kami.jpg';
  } else if (lvl >= 5001) {
    rankName = '皇帝 Kōtei';
    icon = '/Icon exp/Kōtei.jpg';
  } else if (lvl >= 3501) {
    rankName = '伝説 Densetsu';
    icon = '/Icon exp/Densetsu.jpg';
  } else if (lvl >= 2001) {
    rankName = '将軍 Shōgun';
    icon = '/Icon exp/Shōgun.jpg';
  } else if (lvl >= 1001) {
    rankName = '達人 Tatsujin';
    icon = '/Icon exp/Tatsujin.jpg';
  } else if (lvl >= 501) {
    rankName = '精鋭 Seiei';
    icon = '/Icon exp/Seiei.jpg';
  } else if (lvl >= 251) {
    rankName = '先輩 Senpai';
    icon = '/Icon exp/Senpai.jpg';
  } else if (lvl >= 101) {
    rankName = '探索者 Tansakusha';
    icon = '/Icon exp/Tansakusha.jpg';
  }

  const nextLevelExp = getExpNeededForLevel(lvl);

  return {
    level: lvl,
    rankName,
    icon,
    isUnlimited: false,
    nextLevelExp
  };
}

/**
 * Menghitung kenaikan level berdasarkan tambahan EXP
 * @param {number} currentLevel - Level saat ini
 * @param {number} currentExp - EXP saat ini
 * @param {number} earnedAmount - Jumlah EXP yang didapatkan
 * @returns {object} { newLevel, newExp, leveledUp }
 */
export function calculateLevelUp(currentLevel, currentExp, earnedAmount) {
  let newLevel = Math.max(1, parseInt(currentLevel) || 1);
  let newExp = Math.max(0, parseInt(currentExp) || 0) + earnedAmount;
  let leveledUp = false;

  let req = getExpNeededForLevel(newLevel);
  while (newExp >= req) {
    newExp -= req;
    newLevel += 1;
    req = getExpNeededForLevel(newLevel);
    leveledUp = true;
  }

  return {
    newLevel,
    newExp,
    leveledUp
  };
}

/**
 * Menghitung pengurangan level dan EXP (untuk ganti username)
 * @param {number} currentLevel - Level saat ini
 * @param {number} currentExp - EXP saat ini
 * @param {number} currentTotalExp - Total EXP saat ini
 * @param {number} deductAmount - Jumlah EXP yang dipotong
 * @returns {object} { newLevel, newExp, newTotalExp }
 */
export function calculateLevelDown(currentLevel, currentExp, currentTotalExp, deductAmount) {
  let newTotalExp = Math.max(0, (parseInt(currentTotalExp) || 0) - deductAmount);
  let newLevel = Math.max(1, parseInt(currentLevel) || 1);
  let newExp = (parseInt(currentExp) || 0) - deductAmount;

  while (newExp < 0 && newLevel > 1) {
    newLevel -= 1;
    const req = getExpNeededForLevel(newLevel);
    newExp += req;
  }

  newExp = Math.max(0, newExp);

  return {
    newLevel,
    newExp,
    newTotalExp
  };
}

