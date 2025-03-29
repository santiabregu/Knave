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

// 🎯 Start a new battle
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
    message: `👹 Te enfrentas a un ${monster.name}! ¿Qué haces?`,
    turn: 1,
    battleStatus: 'ongoing',
    options: ['attack', 'defend', 'hide'],
    monsterName: monster.name
  });
});

// 🌀 Continue battle turn-by-turn
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
  let log = [];

  // Player's action
  if (action === 'attack') {
    const attackRoll = Math.floor(Math.random() * 20) + 1 + (character.fuerza || 0);
    if (attackRoll >= monster.ac) {
      const dmg = rollDice('1d6').total;
      monster.currentHP -= dmg;
      log.push(`🗡️ Atacaste al ${monster.name} e hiciste ${dmg} de daño.`);
    } else {
      log.push('😓 Fallaste tu ataque.');
    }
  } else if (action === 'defend') {
    log.push('🛡️ Te preparas para defender. Ganas ventaja en la próxima ronda.');
    // You can implement status effects or AC bonus next
  } else if (action === 'hide') {
    const stealth = Math.floor(Math.random() * 20) + 1 + (character.destreza || 0);
    if (stealth >= 15) {
      log.push('🫥 Te escondes con éxito y evitas el próximo ataque.');
      battle.skipMonsterTurn = true;
    } else {
      log.push('👀 El monstruo te ha visto. ¡No pudiste esconderte!');
    }
  } else {
    log.push('🤔 Acción no válida.');
  }

  // Monster's turn (unless hidden)
  if (monster.currentHP > 0 && !battle.skipMonsterTurn) {
    const monsterAttack = Math.floor(Math.random() * 20) + 1 + (monster.attackBonus || 0);
    if (monsterAttack >= 12) {
      const dmg = rollDice(monster.damage || '1d6').total;
      character.currentHP -= dmg;
      log.push(`💥 ${monster.name} te ataca e inflige ${dmg} daño.`);
    } else {
      log.push(`${monster.name} falla su ataque.`);
    }
  } else if (battle.skipMonsterTurn) {
    log.push(`${monster.name} no puede encontrarte. No te ataca.`);
    battle.skipMonsterTurn = false;
  }

  battle.turn++;

  // Check for win/lose
  if (monster.currentHP <= 0) {
    battle.status = 'won';
    battles.delete(telegramId);
    return res.json({
      message: `🏆 Derrotaste al ${monster.name}!`,
      battleStatus: 'won',
      battleLog: log,
      turn: battle.turn
    });
  }

  if (character.currentHP <= 0) {
    battle.status = 'lost';
    battles.delete(telegramId);
    return res.json({
      message: `☠️ Fuiste derrotado por el ${monster.name}.`,
      battleStatus: 'lost',
      battleLog: log,
      turn: battle.turn
    });
  }

  // Ongoing battle
  return res.json({
    message: log.join('\n'),
    battleStatus: 'ongoing',
    turn: battle.turn,
    options: ['attack', 'defend', 'hide']
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`⚔️ Knave Turn-Based Battle Server on port ${PORT}`);
});
