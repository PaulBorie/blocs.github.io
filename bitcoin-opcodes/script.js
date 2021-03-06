// https://en.bitcoin.it/wiki/Script
const CODES = {
	OP_0: 0,
  OP_FALSE: 0,
  OP_1: 1,
  OP_TRUE: 1,
  OP_2: 2,
  OP_3: 3,
  OP_4: 4,
  OP_5: 5,
  OP_6: 6,
  OP_7: 7,
  OP_8: 8,
  OP_9: 9,

  OP_ADD: '<INPUT INPUT> Sum them up',
  OP_SUB: '<INPUT INPUT> Substract them',

  OP_DUP: '<INPUT> Duplicate the input and put it in the stack',
	OP_DROP: 'Removes the top stack item.',

  OP_HASH160: '<INPUT> The input is hashed twice: first with SHA-256 and then with RIPEMD-160.',

  OP_EQUAL: 'Returns 1 if the inputs are exactly equal, 0 otherwise.',
  OP_VERIFY: 'Marks transaction as invalid if top stack value is not true. The top stack value is removed.',

  OP_EQUALVERIFY: 'Same as OP_EQUAL, but runs OP_VERIFY afterward.',
  OP_CHECKSIG: 'check tx signature',
	OP_CHECKMULTISIG: 'Compares the first signature against each public key until it finds an ECDSA match.',
	OP_CHECKSEQUENCEVERIFY: 'Marks transaction as invalid if the relative lock time of the input',

	OP_IF: 'If the top stack value is not False, the statements are executed. The top stack value is removed.',
	OP_ELSE: 'If the preceding OP_IF or OP_NOTIF or OP_ELSE was not executed then these statements are and if the preceding OP_IF or OP_NOTIF or OP_ELSE was executed then these statements are not.',
	OP_ENDIF: 'Ends an if/else block. All blocks must end, or the transaction is invalid. An OP_ENDIF without OP_IF earlier is also invalid.'
}

class StackExecutor {

	constructor(stack, script) {
		this.stack = stack;
		this.script = script;
		this.stepIndex = 0;
		this.isJump = false;

		this.error = null;
		this.result = null;
	}

	nextStep() {
	  let calcVal, doVerify, verify, stackVal;
  	let code = this.script[this.stepIndex];
    let stackLastIndex = this.stack.length - 1;
  	switch(code) {
    	/* op codes for data */
    	case 'OP_0':
      case 'OP_FALSE':
      case 'OP_1':
			case 'OP_TRUE':
      case 'OP_2':
      case 'OP_3':
      case 'OP_4':
      case 'OP_5':
      case 'OP_6':
      case 'OP_7':
      case 'OP_8':
      case 'OP_9':
      	this.stack.push(CODES[code]);
        break;

			case 'OP_IF':
				stackVal = this.stack[stackLastIndex];
				this.stack.splice(stackLastIndex, 1);

				// NOT evaluated, jump to next ELSE or ENDIF
				if (stackVal != 1) {
					for (let i = this.stepIndex; i < this.script.length; i++) {
						if (this.script[i] == 'OP_ELSE' || this.script[i] == 'OP_ENDIF') {
							this.stepIndex = i;
							break;
						}
					}
				}

				break;
			case 'OP_NOTIF':
				stackVal = this.stack[stackLastIndex];
				this.stack.splice(stackLastIndex, 1);

				// NOT evaluated, jump to next ELSE or ENDIF
				if (stackVal != 0) {
					for (let i = this.stepIndex; i < this.script.length; i++) {
						if (this.script[i] == 'OP_ELSE' || this.script[i] == 'OP_ENDIF') {
							this.stepIndex = i;
							break;
						}
					}
				}

				break;

			case 'OP_ENDIF':
				break;
			case 'OP_ELSE':
				// OP_ELSE evaluates only if a OP_IF has been evaluated
				if (!this.isJump) {
					for (let i = this.stepIndex; i < this.script.length; i++) {
						if (this.script[i] == 'OP_ENDIF') {
							this.stepIndex = i;
							break;
						}
					}
				}
				break;

      /* op codes that take 2 inputs and remove them */
      case 'OP_SUB':
      	calcVal = this.stack[stackLastIndex - 1] - this.stack[stackLastIndex];
      case 'OP_ADD':
      	calcVal = calcVal ? calcVal : this.stack[stackLastIndex - 1] + this.stack[stackLastIndex];

        // Removes inputs
        this.stack.splice(stackLastIndex - 1, 2);

        this.stack.push(calcVal);

        break;

      case 'OP_DUP':
        this.stack.push(this.stack[stackLastIndex]);

        break;

			case 'OP_DROP':
				this.stack.splice(stackLastIndex, 1);

				break;

      case 'OP_HASH160':
      	let sha256 = CryptoJS.SHA256(this.stack[stackLastIndex]).toString();

        this.stack[stackLastIndex] = CryptoJS.RIPEMD160(sha256).toString();

        break;

			/* op codes with VERIFY */
      case 'OP_EQUALVERIFY':
      	doVerify = true;
      case 'OP_EQUAL':
				if (!doVerify) {
					let equal = this.stack[stackLastIndex] == this.stack[stackLastIndex - 1];

					// Removes inputs
					this.stack.splice(stackLastIndex - 1, 2);

					this.stack.push(equal ? 1 : 0);

					stackLastIndex = this.stack.length - 1;

					break;
				}

				verify = verify ? verify : this.stack[stackLastIndex] == this.stack[stackLastIndex - 1];
    	case 'OP_VERIFY':
				if (!verify) {
					verify = this.stack[stackLastIndex];
				}

      	if (verify != 1) {
					this.result = false;
					return;
				}

				break;

			case 'OP_CHECKSEQUENCEVERIFY':
				if (this.stack[stackLastIndex] > nSequence) {
					return false;
				}

				break;

     	case 'OP_CHECKSIG':
				// var ec = new KJUR.crypto.ECDSA({'curve': 'secp256k1'});
				// let msg = CryptoJS.SHA256(CryptoJS.SHA256(this.script.toString())).toString();
				//
				// let sig = this.stack[stackLastIndex - 1];
				// let pubKey = this.stack[stackLastIndex];
				// TODO Check signature using ECDSA

        this.stack.splice(stackLastIndex - 1, 2);

        this.stack.push(1);
        break;
			case 'OP_CHECKMULTISIG':
				let n = this.stack[stackLastIndex];
				let m = this.stack[stackLastIndex - n - 1];
				let pubsIndex = stackLastIndex - n;
				let sigsIndex = pubsIndex - m - 1;

				// Public keys
				let pubs = this.stack.slice(pubsIndex, this.stack.length - 1);

				// Signatures
				let sigs = this.stack.slice(sigsIndex, this.stack.length - pubs.length - 2);

				// delete n <pub, pub, pub, ...> m
				this.stack.splice(sigsIndex);

				// TODO Check multi sig using ECDSA (m-n)

				this.stack.push(1);

				break;

    	default:
      	this.stack.push(code);
    }

		this.incrementStep();
	}

	isTerminated() {
		return (this.result != null) || (this.error != null);
	}

	incrementStep() {
		this.stepIndex++;

		if (this.stepIndex >= this.script.length) {
			this.result = this.stack[this.stack.length - 1] == 1;
		}
	}
}
