export class TimerSystem {

  constructor(){
    this.nextTimerId = 0
    this.timersById = {}
  }

  schedule(time, callback){
    this.nextTimerId += 1
    var newId = `TimerID${this.nextTimerId}`
    this.timersById[newId] = {remainingTime : time, callback : callback}
    return newId
  }

  cancel(id){
    if(!(id in this.timersById)) return false
    delete this.timersById[id]
    return true
  }

  update(dt){
    let keysToDelete = []
    let callbacksToCall = []
    for (const [key, value] of Object.entries(this.timersById)) {
      value.remainingTime -= dt
      if (value.remainingTime <= 0){
        callbacksToCall.push(value.callback)
        keysToDelete.push(key)
      }
    }

    for (var i = keysToDelete.length - 1; i >= 0; i--) {
      delete this.timersById[keysToDelete[i]]
    }

    for (var i = 0; i < callbacksToCall.length; i++) {
      callbacksToCall[i]()
    }
  }
}
