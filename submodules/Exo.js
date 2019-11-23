class Exo {

	constructor(parent) {
  
	  this.parent = parent;
	  
	  let unlock = false
  
	  this.parent.m.hook('S_ABNORMALITY_BEGIN', 4, event => {
		if (!this.parent.g.me.is(event.target)) return
		if (event.id === 30010000) unlock = true
	  })
		
	  this.parent.m.hook('S_ABNORMALITY_END', 1, event => {
		if (!this.parent.g.me.is(event.target)) return
		if (event.id === 30010000) unlock = false
	  })
	  
	  this.parent.g.me.on('change_zone', (zone, quick) => {
		if (zone === 2000 && !unlock) {
		  unlock = true
		  this.parent.m.send('S_ABNORMALITY_BEGIN', 4, {
			target: this.parent.g.me.gameId,
			source: this.parent.g.me.gameId,
			id: 30010000,
			duration: 0x7FFFFFFF,
			stacks: 1
		  })
		}
		
		if (zone !== 2000 && unlock) {
		  unlock = false
		  this.parent.m.send('S_ABNORMALITY_END', 1, {
			target: this.parent.g.me.gameId,
			id: 30010000
		  })
		}
	  })
  
	}
  
	destructor() {}
  
  }
  
  module.exports = Exo;