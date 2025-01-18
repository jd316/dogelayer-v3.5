
class Token {
	constructor(material) {
	  this.material = material;
	}
   
	go() {
	  return `https://go.getblock.io/${this.material}/`;
	}
   
	token() {
	  return this.material;
	}
}

export const getblock = {
	"shared": {
		"doge": {
			"mainnet": {
				"jsonRpc": [
					new Token ('12d6ffab3fd945fa9dcf93388209c421')
				]
			}
		}
	}
}
