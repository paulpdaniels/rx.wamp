rx.wamp
=======

A Reactive wrapper library for the autobahn wamp v1/v2 library in the browser/node


### Installation


#### Regular browser
```javascript

<script type="application/javascript" src="javascripts/rx.wamp.js" ></script>

```

#### RequireJS
```javascript

require(['autobahn', 'rx.wamp'], function(autobahn) {

  //Do stuff

});

```

#### NodeJS
```javascript

var autobahn = require('autobahn');
var rxwamp = require('rx.wamp');


//Do stuff with the autobahn
autobahn
  .connectObservable({url: 'ws://localhost:9000', realm: 'realm1'});


```


### Connection
```javascript

function newSession(session) {
  console.log("A new session was created");
}

var connectionSubscription = Rx.Observable.fromConnection("ws://localhost:9000")
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

//You may optionally pass in an observer to listen for the subscription completing
var openObserver = Rx.Observer.create();

var topic = Rx.Observable.subscribeAsObservable(session, "wamp.my.foo", options, openObserver);

//Do all the normal reactive operations on it
topicObservable
  .filter(validateArgs)
  .map(getResultValue)
  .subscribe(console.log);
    
//Unsubscribe from topic
topicSubscription.dispose();

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

session.callAsObservable("wamp.my.add", [2, 3], {}, {})
    .subscribe(function(value){
      // => 5
      console.log("Result was %s", value.args[0]);
    });
    
//Shorthand
var add = session.caller("wamp.my.add");

var addResult = add([2, 3]);

addResult.subscribe(function(value) {
  // => 5
  console.log("Result was the same %d", value.args[0]);
});

//Subscribe as many times as possible
addResult.subscribe(function(value) {});


```

### Advanced

```javascript

//Create a pipeline of distributed computation
var adder = session.caller("wamp.my.add");
var multiplier = session.caller("wamp.my.multiply");

//Somewhat contrived but you get the idea
var pipeline = 
  adder([2, 3])
    .zip(adder([3, 4]), function(value1, value2) { 
      return [value1.args[0], value2.args[0]];
    })
    .flatMap(function(value) { 
      return multiplier(value[0], value[1]); 
    });
  
  pipeline.subscribe(function(value){
    // =>  (2 + 3) * (3 + 4) = 35
    console.log("Result was %d", value.args[0]);
  })


```

## V1

It also supports the v1 library.


### Subscribing

```javascript

//Notice the difference between this and v2
session.subscribeAsObservable("wamp.subscribe.event")
  .subscribe(function(event) {
    console.log("New event: %s", event);
  });

```

### Publishing

```javascript

session.publishAsObservable("wamp.publish.event", {id : "me"}, true)
  .subscribeOnCompleted(function(){});

```

### Calling methods

```javascript

session.callAsObservable("wamp.my.add", 2, 3)
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



