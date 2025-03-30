const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const battles = new Map(); // key = telegramId

function rollDice(dice) {
  const [_, count, sides] = dice.match(/(\d*)d(\d+)/) || [];
  const rolls = Array.from({ length: parseInt(count || 1) }, () =>
    Math.floor(Math.random() * parseInt(sides)) + 1
  );
  return {
    total: rolls.reduce((a, b) => a + b, 0),
    rolls
  };
}

// 🎯 Start battle
app.post('/battle/start', (req, res) => {
  const { character, monster, telegramId } = req.body;

  if (!character || !monster || !telegramId) {
    return res.status(400).json({ error: 'Missing character, monster, or telegramId' });
  }

  const battle = {
    character: { ...character, currentHP: character.hp },
    monster: {
      ...monster,
      hp: monster.hd ? monster.hd * 4 : 20,
      currentHP: monster.hd ? monster.hd * 4 : 20,
    },
    turn: 1,
    status: 'ongoing'
  };

  battles.set(telegramId, battle);

  return res.json({
    description: monster.notes || `👹 Un ${monster.name} aparece ante ti.`,
    monsterName: monster.name,
    turn: 1,
    battleStatus: 'ongoing'
  });
});

// 🌀 Battle turn
app.post('/battle/action', (req, res) => {
  const { telegramId, action } = req.body;

  if (!telegramId || !action) {
    return res.status(400).json({ error: 'Missing telegramId or action' });
  }

  const battle = battles.get(telegramId);
  if (!battle || battle.status !== 'ongoing') {
    return res.json({ message: '❌ No hay combate activo. Usa /battle/start.' });
  }

  const { character, monster } = battle;
  const log = [];

  // 🎮 Player action
  if (action === 'attack') {
    const roll = Math.floor(Math.random() * 20) + 1 + (character.fuerza || 0);
    if (roll >= monster.ac) {
      const dmg = rollDice('1d6').total;
      monster.currentHP -= dmg;
      log.push(`🗡️ Atacaste al ${monster.name} e hiciste ${dmg} de daño.`);
    } else {
      log.push('😓 Fallaste tu ataque.');
    }
  } else if (action === 'defend') {
    log.push('🛡️ Te preparas para defender. Ganas ventaja en la próxima ronda.');
  } else if (action === 'hide') {
    const stealth = Math.floor(Math.random() * 20) + 1 + (character.destreza || 0);
    if (stealth >= 15) {
      log.push('🫥 Te escondes exitosamente. Evitas el siguiente ataque.');
      battle.skipMonsterTurn = true;
    } else {
      log.push('👀 El monstruo te ha visto. ¡No pudiste esconderte!');
    }
  } else {
    log.push('🤔 Acción no reconocida.');
  }

  // 👹 Monster turn
  if (monster.currentHP > 0 && !battle.skipMonsterTurn) {
    const roll = Math.floor(Math.random() * 20) + 1 + (monster.attackBonus || 0);
    if (roll >= 12) {
      const dmg = rollDice(monster.damage || '1d6').total;
      character.currentHP -= dmg;
      log.push(`💥 ${monster.name} te ataca e inflige ${dmg} de daño.`);
    } else {
      log.push(`${monster.name} falla su ataque.`);
    }
  } else if (battle.skipMonsterTurn) {
    log.push(`${monster.name} no te encuentra. Se salta su turno.`);
    battle.skipMonsterTurn = false;
  }

  battle.turn++;

  // ☠️ Check win/lose
  if (monster.currentHP <= 0) {
    battles.delete(telegramId);
    return res.json({
      result: 'victory',
      log,
      turn: battle.turn,
      finalHP: character.currentHP
    });
  }

  if (character.currentHP <= 0) {
    battles.delete(telegramId);
    return res.json({
      result: 'defeat',
      log,
      turn: battle.turn,
      finalHP: 0
    });
  }

  // 🔁 Ongoing
  return res.json({
    result: 'ongoing',
    log,
    turn: battle.turn,
    characterHP: character.currentHP,
    monsterHP: monster.currentHP,
    nextOptions: ['attack', 'defend', 'hide']
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`⚔️ Knave Turn-Based Battle Server running on port ${PORT}`);
});
