rx.wamp
=======

A wrapper library for the autobahn wamp v1/v2 library in the browser/node


### Connection
```javascript

function newSession(session) {
  console.log("A new session was created");
}

var connectionSubscription = autobahn.connectObservable("ws://localhost:9000")
    .subscribe(newSession);
    
//Close our current connection and don't retry
connectionSubscription.dispose();


```


### Subscribing to topics
```javascript

function validateArgs(value) {
  return value.args && value.args.length > 1;
}

function getResultValue(value) {
  return value.args[1];
}

var topicObservable = session.subscribeObservable("wamp.my.foo", {});

//Do all the normal reactive operations on it

//Only care about the events
var topicSubscription = 
topicObservable
    .concatAll()
    .filter(validateArgs)
    .map(getResultValues)
    .subscribe(function(value){
        //This will print only the second argument
        console.log("Got %s", value.args);
    });
    
//Nested way, listen for subscription
topicSubscription2 = 
topicObservable
  .subscribe(function(topic){
      
      topic
      .filter(validateArgs)
      .map(getResultValues)
      .take(4)
      .subscribe(function(value){
        console.log("Got %s", value.args);
      });
      
  })
    
    
//Unsubscribe from topic
topicSubscription.dispose();
topicSubscription2.dispose();

```

### Registering methods
```javascript

function endpoint(args, kwargs, details) {
  if (args === undefined || args.length < 1)
    throw new autobahn.Error("No values to sum!");
  else if (args.length > 2) {
    throw new autobahn.Error("Too many values!");
  } else {
    return args[0] + args[1];
  }
}

function onError(e) {
  //This will get called for all errors.
}

var registration = 
  session
    .registerObservable("wamp.my.add", endpoint, {})
    //This will bubble up all errors that occur either
    //during registration or unregistration.
    .subscribeOnError(onError);
    

//Unregister
registration.dispose();

```



### Calling methods

We can call methods, like the one in the example above, as well.

```javascript

session.callObservable("wamp.my.add", [2, 3], {}, {})
    .subscribe(function(value){
      // => 5
      console.log("Result was %s", value.args[0]);
    });
    
//Shorthand
var add = session.caller("wamp.my.add");

add([2, 3]).subscribe(function(value) {
  // => 5
  console.log("Result was the same %d", value.args[0]);
});
```

## V1

It also supports the v1 library.


### Subscribing

```javascript

//Notice the difference between this and v2
session.subscribeObservable("wamp.subscribe.event")
  .subscribe(function(event) {
    console.log("New event: %s", event);
  });

```

### Publishing

```javascript

session.publishObservable("wamp.publish.event", {id : "me"}, true)
  .subscribeOnCompleted(function(){});

```

### Calling methods

```javascript

session.callObservable("wamp.my.add", 2, 3)
  .subscribe(function(value){
    console.log("Result was %d", value);
  });
  
  

```




###TODO

- [X] [Major] ~~Implement cross-platform compatibility (currently only works in node)~~
- [ ] [Major] Bug fixing
- [ ] [Major] Improve API semantics and readability
- [ ] [Major] Push to cdn platforms (~~npm~~/bower/cdnjs or microjs).
- [x] [Minor] ~~Add v1 backward compatibility~~



