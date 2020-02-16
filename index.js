
module.exports = function fly(mod) {
	const CATEGORY_GLOBAL = 9999
	const SKILL_FLYING_DISMOUNT = 65000001
	var currZone;
	
	let gameId = -0n,
		location = null,
		outOfEnergy = false,
		dismountByUser = false,
		mountDisabled = false,
		inCombat = false,
		mountSkill = -1,
		serverMounted = false,
		remountTimer = null,
		unlock = false
	
	mod.hook('C_PLAYER_FLYING_LOCATION', 4, (event) => {
		location = {
			flying: true,
			pos: event.loc,
			dir: event.w
		}
		
		if (outOfEnergy && event.type !== 7 && event.type !== 8) {
			event.type = 7
			return true
		}
	})

	mod.hook('S_LOAD_TOPO', 3, e=>{
		currZone = e.zone;
	});
	
	mod.hook('C_PLAYER_LOCATION', 5, (event) => {
		location = {
			flying: false,
			pos: event.loc,
			dir: event.w
		}
		([2, 10].includes(e.type) && (currZone < 10 || currZone > 200));
	})
	
	mod.hook('C_START_SKILL', 7, (event) => {
		if (event.skill.id == mountSkill || event.skill.id == SKILL_FLYING_DISMOUNT) {
			dismountByUser = true
			mountSkill = -1
		}
	})
	
	mod.hook('S_CANT_FLY_ANYMORE', 1, (event) => {
		return false
	})
	
	mod.hook('S_MOUNT_VEHICLE', 2, {order: 10}, (event) => {
		if (event.gameId == mod.game.me.gameId) {
			const fakeMounted = mountSkill !== -1
			serverMounted = true
			mountSkill = event.skill
			if (fakeMounted) {
				return false
			}
		}
	})
	
	mod.hook('S_PLAYER_CHANGE_FLIGHT_ENERGY', 1, (event) => {
		outOfEnergy = (event.energy === 0)
	})
	
	mod.hook('S_SKILL_CATEGORY', 3, (event) => {
		if (event.category == CATEGORY_GLOBAL) {
			mountDisabled = !event.enabled
		}
	})
	
	mod.hook('S_UNMOUNT_VEHICLE', 2, {order: 10}, (event) => {
		if (event.gameId != mod.game.me.gameId) {
			return
		}
		serverMounted = false
		if (!location.flying || dismountByUser) {
			dismountByUser = false
			mountSkill = -1
		} else {
			clearTimeout(remountTimer)
			remountTimer = setTimeout(tryRemount, 50)
			return false
		}
	})
	
	mod.hook('S_USER_STATUS', 3, (event) => {
		if (event.gameId == mod.game.me.gameId) {
			inCombat = event.status == 1
		}
	})
	
	function tryRemount() {
		if (!mountDisabled && !inCombat) {
			mod.send('C_START_SKILL', 7, {
				skill: mountSkill,
				w: location.dir,
				loc: location.pos,
				unk: true
			})
			remountTimer = setTimeout(() => {
				if (!serverMounted) {
					mod.send('S_UNMOUNT_VEHICLE', 2, {
						gameId,
						skill: mountSkill
					})
					mountSkill = -1
				}
			}, 1000)
		} else {
			mod.send('S_UNMOUNT_VEHICLE', 2, {
				gameId,
				skill: mountSkill
			})
			mountSkill = -1
		}
	}

	mod.hook('S_ABNORMALITY_BEGIN', 4, event => {
		if (!mod.game.me.is(event.target)) return
		if (event.id === 30010000) unlock = true
	})
		
	mod.hook('S_ABNORMALITY_END', 1, event => {
		if (!mod.game.me.is(event.target)) return
		if (event.id === 30010000) unlock = false
	})
	
	mod.game.me.on('change_zone', (zone, quick) => {
		if (zone === 2000 && !unlock) {
			unlock = true
			mod.send('S_ABNORMALITY_BEGIN', 4, {
				target: mod.game.me.gameId,
				source: mod.game.me.gameId,
				id: 30010000,
				duration: 0x7FFFFFFF,
				stacks: 1
			})
		}
		
		if (zone !== 2000 && unlock) {
			unlock = false
			mod.send('S_ABNORMALITY_END', 1, {
				target: mod.game.me.gameId,
				id: 30010000
			})
		}
	})
	
}
