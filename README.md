


rx.wamp [![NPM version](http://img.shields.io/npm/v/rx.wamp.svg)](https://npmjs.org/package/rx.wamp)
=======

A Reactive wrapper library for the autobahn wamp v1/v2 library in the browser/node

*If you have been using below version 0.2.0 please see below for important API changes!*


### Installation


#### Regular browser
```javascript

<script type="application/javascript" src="javascripts/lib/autobahn.js"></script>
<script type="application/javascript" src="https://cdnjs.cloudflare.com/ajax/libs/rxjs/2.3.22/rx.lite.js"></script>
<script type="application/javascript" src="javascripts/rx.wamp.js" ></script>

```

#### RequireJS
```javascript

require(['rx.wamp'], function(Rx) {

  //Do stuff

});

```

#### NodeJS
```javascript

var rxwamp = require('rx.wamp');


//Do stuff with the autobahn
//This works for both versions, though realm is only required in version 2
Rx.Observable
  .fromConnection({url: 'ws://localhost:9000', realm: 'realm1'});

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
var topicSubscription = topic
  .filter(validateArgs)
  .map(getResultValue)
  .subscribe(console.log);
    
//Unsubscribe from topic, you will no longer receive updates from this topic
topicSubscription.dispose();

```

##### New in version 0.3!

You can now pass your connection observable directly into your subscription so that it will persist across sessions

```javascript

Rx.Observable.subscribeAsObservable(Rx.Observable.fromConnection("ws://myconnectionurl:9090"), "wamp.my.foo", onResult);

```

#### New in version 0.5!

You can now use an even shorter-hand for subscription. These will automatically persist across sessions if you use the 
`fromConnection()` overload.

```javascript

var connection = Rx.Observable.fromConnection("ws://myconnectionurl:9090");

//You can subscribe to as many items as you want
var subscriber = 
Rx.Observable.subscriber(connection)
  .to("wamp.my.foo", {}, fooObserver)
  .to("wamp.my.other.foo", function(message) {}, function(ex) {}, function(){});
  
//You may cancel all of the items with one command as well
subscriber.dispose();
  
  
  

```

### Publishing to topic

```javascript

//Version 2
var published = Rx.Observable.publishAsObservable(session, "wamp.my.foo", [42], {key : "value"}, {});

//Version 1 - Overloads
Rx.Observable.publishAsObservable(session, "wamp.my.foo", { args : [42], kwargs : { key : "value" } }, true);
Rx.Observable.publishAsObservable(session, "wamp.my.foo", { args : [42], kwargs : { key : "value" } }, [12345678]);
Rx.Observable.publishAsObservable(session, "wamp.my.foo", { args : [42], kwargs : { key : "value" } }, [12345678], [87654321]);

```



### Or use them together
```javascript

//Surfaces a subject which can do both publication and subscription
var topic = Rx.Observable.fromPubSubPattern(session, "wamp.pubsub.topic", {});

//When the topic successfully subscribes it is surfaced through the 'opened' property
topic.opened.subscribe(function(){
  console.log("subscribed to topic");
});

//Errors in publishing are surfaced through the 'errors' property
topic.errors.subscribe(function(err){
  console.log("There was an error publishing the message");
});

//subscribe to the observer
topic.subscribe(observer);

//publish to the observer
Rx.Observable.generateWithRelativeTime(0, 
  function(x) {return x < 42; },
  function(x) {return x + 1; },
  function(x) {return {args : [x]}; },
  function(x) {return 15; })
  .subscribe(topic);
  

```

### Registering methods
#### Note that this will only work in version 2
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
  Rx.Observable
    .registerAsObservable(session, "wamp.my.add", endpoint, {})
    //This will bubble up all errors that occur either
    //during registration or unregistration.
    .subscribeOnError(onError);
    

//Unregister
registration.dispose();

```

##### New in version 0.3!

You can now pass your connection observable directly into your registration so that it will persist across sessions

```javascript

var connection = Rx.Observable.fromConnection({url : myUrl, realm : 'realm1'});

Rx.Observable.registerAsObservable(connection, "wamp.my.add", endpoint, {});

```


### Calling methods

We can call methods, like the one in the example above, as well.

```javascript

var caller = session.callAsObservable("wamp.my.add", {});

//Version 2
caller([2, 3], {})
    .subscribe(function(value){
      // => 5
      console.log("Result was %s", value.args[0]);
    });

//Resubscribing will yield the cached result
addResult.subscribe(function(value) {
      console.log("Result was %s", value.args[0]);
});

//Version 1
caller(2, 3)
  .subscribe(function(value) {});

```

### Authentication
#### Currently only available in V1


```javascript

//In this case the *this* of the onchallenge function will be the session.
Rx.Observable.authreqAsObservable(session, 
//Raised when the server challenges the authentication
function onchallenge(challenge){
  var signature = this.authsign(challenge, "");
  return this.auth(signature);
}, 
"blahsomeauthenticationkeyblah", 
{});

```


### Advanced

#### Weather Station Monitor

```javascript

//listen for sensor readings
var sensorReadings = Rx.Observable.subscribeAsObservable(session, "weather.sensor");

//A remote service for analyzing our readings, it might be aggregating across several different sources
var analyzer = Rx.Observable.callAsObservable(session, "weather.forecast.compute");

//Home control settings
var desiredTemperature = Rx.Observable.subscribeAsObservable(session, "temperature.indoors.desired");

var dailyForecast = 
sensorReadings
  .map(function(rawValue){
    //Some compatibility so we can transparently use between versions
    return rawValue.kwargs || rawValue.event;
  })
  .throttleFirst(1000) // At most once every second
  .bufferWithTime(1000 * 60 * 60 * 24) //Milliseconds in a day
  .tap(function(readings) {
    //Send these off to our visualizer somewhere on the network
    Rx.Observable.publishAsObservable(session, "weather.visualizer.daily", readings);
  })
  .flatMap(function(readings) {
    //This returns an observable which we will flatMap back into our stream
    return analyzer(readings);
  })
  .publish().refCount();

//Warn of inclement weather coming in  
dailyForecast
  //only get warnings
  .filter(function(weather) {
    return weather.warnings.length > 0;
  })
  .map(function(weather) {
    //remap only the first warning, don't know why, just cause
    var warning = weather.warnings[0];
    return {type : warning.type, severity : warning.severity, message : "GET TO DA CHOPPA!!"};
  })
  //Publish it to our klaxon service to warn everyone on the block
  .subscribe(Rx.Observable.publishAsObservable.bind(null, session, "weather.warnings.klaxon"));
  
//Notify the climate control to turn off
dailyForecast
  .map(function(weather) {
    return weather.temperature.average;
  })
  .combineLatest(desiredTemperature, function(actual, desired) {
    return Math.abs(desired - actual);
  })
  .map(function(difference) {
    return {state : difference > 4};
  })
  .subscribe(Rx.Observable.publishAsObservable.bind(null, session, "indoor.climatecontrol.active"));
  


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

###TODO

- [X] [Major] ~~Implement cross-platform compatibility (currently only works in node)~~
- [ ] [Major] Bug fixing
- [X] [Major] Improve API semantics and readability
- [ ] [Major] Push to cdn platforms (~~npm~~/bower/cdnjs or microjs).
- [x] [Minor] ~~Add v1 backward compatibility~~



