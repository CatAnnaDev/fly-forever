/** @format */
const path = require("path"),
  fs = require("fs")

module.exports = function fly(mod) {
  const CATEGORY_GLOBAL = 99999
  const SKILL_FLYING_DISMOUNT = 65000001
  const SKILL_FLYING_MOUNT = 12200271
  var currZone
  /*
 category: 13003
 category: 13009
 category: 13021
  */

  let gameId = 0n,
    location = null,
    outOfEnergy = false,
    dismountByUser = false,
    mountDisabled = false,
    inCombat = false,
    mountSkill = -1,
    serverMounted = false,
    remountTimer = null,
    unlock = false,
    enabled = false,
    _inCombat = false,
    config,
    fileopen = true,
    stopwrite,
    mounted = false,
    delay = 0,
    setMount = false,
    currentMount = 0,
    bigzero = BigInt(0),
    w,
    loc,
    flying = false

  try {
    config = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"))
    enabled = config.enabled
  } catch (e) {
    config = JSON.parse(fs.readFileSync(path.join(__dirname, "config-default.json"), "utf8"))
    save(config, "config.json")
    msg("New Config loaded")
  }

  if (mod.majorPatchVersion >= 100) {
    mod.game.initialize
    currentMount = config.currentMount[mod.game.me.name]
    delay = config.delay
    enabled = config.enabled
  }

  mod.hook("C_PLAYER_FLYING_LOCATION", 4, (event) => {
    location = {
      flying: true,
      pos: event.loc,
      dir: event.w,
    }

    if (outOfEnergy && event.type !== 7 && event.type !== 8) {
      event.type = 7
      return true
    }
  })

  mod.hook("S_LOAD_TOPO", 3, (e) => {
    currZone = e.zone
  })

  mod.hook("C_PLAYER_LOCATION", 5, (e) => {
    return !([2, 10].includes(e.type) && (currZone < 10 || currZone > 200))
  })

  mod.hook("C_PLAYER_LOCATION", 5, (event) => {
    location = {
      flying: false,
      pos: event.loc,
      dir: event.w,
    }
  })
  mod.hook("C_PLAYER_LOCATION", 5, (event) => {
    flying = false
    if (enabled && !mounted && !_inCombat) {
      switch (event.type) {
        case 0:
        case 1:
          delay--
          w = event.w
          loc = event.loc
          mount()
          break
        default:
          delay = config.delay
      }
    }
  })

  mod.hook("S_MOUNT_VEHICLE", 2, (event) => {
    if (!mod.game.me.is(event.gameId)) return

    mounted = true
    flying = false

    if (setMount) {
      currentMount = event.skill
      setMount = false
      config.currentMount[mod.game.me.name] = currentMount
      msg("Mount set to: " + currentMount)
      save(config, "config.json")
    }
  })

  mod.hook("S_UNMOUNT_VEHICLE", 2, (event) => {
    if (!mod.game.me.is(event.gameId)) return

    mounted = false
    flying = false
    delay = config.delay
  })

  mod.hook("S_SHORTCUT_CHANGE", 2, (event) => {
    if (enabled && mounted) return false
  })

  mod.hook("C_START_SKILL", 7, { order: -999 }, (event) => {
    return unmount()
  })

  mod.hook("C_PRESS_SKILL", 4, { order: -999 }, (event) => {
    return unmount()
  })

  mod.hook("C_PLAYER_FLYING_LOCATION", 4, (event) => {
    flying = true
  })

  mod.hook("C_START_SKILL", 7, (event) => {
    if (event.skill.id == mountSkill || event.skill.id == SKILL_FLYING_DISMOUNT) {
      dismountByUser = true
      mountSkill = -1
    }
  })

  mod.hook("S_CANT_FLY_ANYMORE", 1, (event) => {
    return false
  })

  mod.hook("S_MOUNT_VEHICLE", 2, { order: 10 }, (event) => {
    if (event.gameId == mod.game.me.gameId) {
      const fakeMounted = mountSkill !== -1
      serverMounted = true
      mountSkill = event.skill
      if (fakeMounted) {
        return false
      }
    }
  })

  mod.hook("S_PLAYER_CHANGE_FLIGHT_ENERGY", 1, (event) => {
    outOfEnergy = event.energy === 0
  })

  mod.hook("S_SKILL_CATEGORY", 3, (event) => {
    if (event.category == CATEGORY_GLOBAL) {
      mountDisabled = !event.enabled
    }
  })

  mod.hook("S_UNMOUNT_VEHICLE", 2, { order: 10 }, (event) => {
    if (event.gameId != mod.game.me.gameId) {
      return
    }
    serverMounted = false
    if (!location.flying || dismountByUser) {
      dismountByUser = false
      mountSkill = -1
    } else {
      clearTimeout(remountTimer)
      remountTimer = setTimeout(tryRemount, 30)
      return false
    }
  })

  mod.hook("S_USER_STATUS", 3, (event) => {
    if (event.gameId == mod.game.me.gameId) {
      inCombat = event.status == 1
    }
    _inCombat = event.status == 1

    if (_inCombat && enabled) delay = config.delay
  })

  function unmount() {
    if (enabled && mounted && !flying) {
      mod.toServer("C_UNMOUNT_VEHICLE", 1, {})
      mod.send("C_UPDATE_REACTION_POS", 1, {
        skill: currentMount,
        loc: location.pos,
      })
      mod.toClient("S_UNMOUNT_VEHICLE", 2, {
        gameId: mod.game.me.gameId,
        skill: currentMount,
      })
      return false
    }

    return true
  }

  function mount() {
    currentMount = config.currentMount[mod.game.me.name]

    if (enabled && delay <= 0 && !_inCombat) {
      if (currentMount == 0 || currentMount == null) {
        msg("mount not set. Use command: am set")
        enabled = false
        return
      }
      delay = config.delay

      mod.toServer("C_START_SKILL", 7, {
        skill: {
          reserved: 0,
          npc: false,
          type: 1,
          huntingZoneId: 0,
          id: currentMount,
        },
        w: w,
        loc: loc,
        dest: {
          x: 0,
          y: 0,
          z: 0,
        },
        unk: true,
        moving: false,
        continue: false,
        target: bigzero,
        unk2: false,
      })
    }
  }

  function tryRemount() {
    if (!mountDisabled && !inCombat) {
      mod.send("C_START_SKILL", 7, {
        skill: mountSkill,
        w: location.dir,
        loc: location.pos,
        unk: true,
      })
      mod.send("C_UPDATE_REACTION_POS", 1, {
        skill: mountSkill,
        loc: location.pos,
      })
      remountTimer = setTimeout(() => {
        if (!serverMounted) {
          mod.send("S_UNMOUNT_VEHICLE", 2, {
            gameId,
            skill: mountSkill,
          })
          mountSkill = -1
        }
      }, 1000)
    } else {
      mod.send("S_UNMOUNT_VEHICLE", 2, {
        gameId,
        skill: mountSkill,
      })
      mountSkill = -1
    }
  }

  function save(data, filename) {
    if (fileopen) {
      fileopen = false
      fs.writeFile(path.join(__dirname, filename), JSON.stringify(data, null, "\t"), (err) => {
        if (err) {
          mod.command.message("Error Writing File, attempting to rewrite")
          console.log(err)
        }
        fileopen = true
      })
    } else {
      clearTimeout(stopwrite) //if file still being written
      stopwrite = setTimeout(save(__dirname, filename), 2000)
      return
    }
  }

  function msg(event) {
    mod.command.message(event)
  }

  mod.command.add(["ff"], {
    $none() {
      enabled = !enabled
      config.enabled = enabled
      save(config, "config.json")
      msg(enabled ? "enabled" : "disabled")
    },
    set() {
      setMount = !setMount
      msg(setMount ? "Setting Mount ON" : "Setting Mount OFF")
    },
    delay(arg) {
      delay = Number(arg)
      config.delay = delay
      save(config, "config.json")
      msg("delay set to " + delay)
    },
  })
}
