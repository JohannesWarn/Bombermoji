var url = new URL(window.location);

var ts = parseInt(url.searchParams.get("ts"));
ts = ts > 0 ? ts : 90;
var canvas = document.getElementById("game-canvas");
var context = canvas.getContext("2d");

var width = Math.floor((window.innerWidth - 0) * 2 / ts);
var height = Math.floor((window.innerHeight - 10) * 2 / ts);
width = (width - (1 + width) % 2);
height = (height - (1 + height) % 2)
canvas.width = ts * width;
canvas.height = ts * height;
canvas.style.width = canvas.width / 2 + "px";
canvas.style.height = canvas.height / 2 + "px";

var gameStarted = false;

var directions = [
  { x: 0, y: -1},
  { x: 1, y: 0},
  { x: 0, y: 1},
  { x: -1, y: 0}
];

class Player {
  constructor(id) {
    //x = Math.min(Math.max(1, x), width - 2);
    //y = Math.min(Math.max(1, y), height - 2);
    //this.originalX = Math.floor(x);
    //this.originalY = Math.floor(y);
    
    this.width = this.height = ts;
    this.id = id;
    this.dir = { x: 0, y: 0};
    this.lastWalkedX = false;
    this.keys = {"up": -1, "down": -1, "left": -1, "right": -1, "bomb": -1};
    this.animation = {
      name: "standing",
      frame: 0
    };
    
    this.consecutiveWins = 0;
  }
  
  main() {
    // Update input
    this.dir = { x: 0, y: 0};
    this.wantToDropBomb = false;
    
    if (keyIsDown[this.keys["up"]]) {
      this.dir.y = -1;
    } else if (keyIsDown[this.keys["down"]]) {
      this.dir.y = 1;
    } 
    if (keyIsDown[this.keys["left"]]) {
      this.dir.x = -1;
    } else if (keyIsDown[this.keys["right"]]) {
      this.dir.x = 1;
    }
    if (keyIsDown[this.keys["bomb"]]) {
      this.wantToDropBomb = true;
    }
    
    var gamepads = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads : []);
    var gamepad = gamepads[Math.floor((this.id - 2) / 2)];
    if (gamepad) {
      var playerOnPad = (this.id % 2);
      var verticalAxis = gamepad.axes[1 + playerOnPad * 2 ];
      var horizontalAxis = gamepad.axes[0 + playerOnPad * 2 ];
      var threshold = 0.25;
      
      var upButton = gamepad.buttons[playerOnPad ? 0 : 12];
      var downButton = gamepad.buttons[playerOnPad ? 2 : 13];
      var leftButton = gamepad.buttons[playerOnPad ? 3 : 14];
      var rightButton = gamepad.buttons[playerOnPad ? 1 : 15];
      
      if (verticalAxis < -threshold || upButton.pressed) {
        this.dir.y = -1;
      } else if (verticalAxis > threshold || downButton.pressed) {
        this.dir.y = 1;
      }
      if (horizontalAxis < -threshold || leftButton.pressed) {
        this.dir.x = -1;
      } else if (horizontalAxis > threshold || rightButton.pressed) {
        this.dir.x = 1;
      }
      
      if (gamepad.buttons[4 + playerOnPad].pressed || gamepad.buttons[6 + playerOnPad].pressed) {
        this.wantToDropBomb = true;
      }
    }
    
    if (!this.joined || this.dead) {
      if (this.wantToDropBomb && !gameStarted) {
        this.dead = false;
        this.joined = true;
        
        var x = startPositions[activePlayers].x;
        var y = startPositions[activePlayers].y;
        x = Math.min(Math.max(1, x), width - 2);
        y = Math.min(Math.max(1, y), height - 2);
        this.originalX = Math.floor(x);
        this.originalY = Math.floor(y);
        this.x = (this.originalX + 0.5) * ts;
        this.y = (this.originalY + 0.5) * ts;
        this.clearSpace();
        
        activePlayers += 1;
        if (activePlayers >= 2) {
          document.getElementsByTagName("h1")[0].textContent = "PRESS SPACE TO PLAY";
        }
      }
      return;
    }
    
    // Update animation and speed
    if (this.dir.x || this.dir.y) {
      this.speed += this.maxSpeed * 0.3;
      this.animation.name = "walking";
      this.animation.frame = (this.animation.frame + 1) % 20;
    } else {
      this.speed -= this.maxSpeed * 0.3;
      this.animation.name = "standing";
      this.animation.frame = 0;
    }
    
    if (this.speed < 0) { this.speed = 0; }
    if (this.speed > this.maxSpeed) { this.speed = this.maxSpeed; }
    
    // Pre movement calculations
    var xpos = Math.floor( this.x / ts );
    var ypos = Math.floor( this.y / ts );
    
    var centerDistance = {
      x: (xpos + 0.5) * ts - this.x,
      y: (ypos + 0.5) * ts - this.y,
    }
    
    // Handle object collision
    var object = objectAt(this.x, this.y);
    if (object) {
      if (object.deadly) {
        this.dead = true;
        object.countdown = -1;
      } else if (object.type == "item") {
        if (object.itemType == "💣") {
          this.bombsAvailable += 1;
        } else if (object.itemType == "🔥") {
          this.expolosionStrength += 1;
        } else if (object.itemType == "👞") {
          this.speedPower += 1;
          this.updateMaxSpeed();
        }
        objects.splice(objects.indexOf(object), 1);
      } else {
        if (Math.sign(centerDistance.x) == this.dir.x && this.insideDropedBomb != object) {
          this.dir.x = 0;
        }
        if (Math.sign(centerDistance.y) == this.dir.y && this.insideDropedBomb != object) {
          this.dir.y = 0;
        }
      }
    } else {
      this.insideDropedBomb = false;
    }
    
    // Drop the bomb
    if (this.wantToDropBomb) {
      if (this.readyToDropBomb) {
        this.readyToDropBomb = false;
        
        if (gameStarted) {  
          if (!object && this.bombsAvailable > 0) {
            //this.speedPower += 1;
            //this.updateMaxSpeed();
            var bomb = new Object("bomb", Math.floor(this.x / ts), Math.floor(this.y / ts));
            bomb.player = this;
            this.insideDropedBomb = bomb;
            this.bombsAvailable -= 1;
          }
        } else {
          this.randomizeEmoji();
        }
      }
    } else {
      this.readyToDropBomb = true;
    }
    
    // Movement
    
    var trailingX = this.x - Math.sign(centerDistance.x) * (this.width / 6);
    var trailingY = this.y - Math.sign(centerDistance.y) * (this.height / 6);
    
    var couldWalk = {
      x: 
        this.dir.x &&
        stage.tileAt(this.x, this.y).walkable.x &&
        stage.tileAt(this.x, trailingY).walkable.x &&
        stage.tileAt(this.x + this.dir.x * (ts / 2 + this.maxSpeed), this.y).walkable.x,
      y:
        this.dir.y &&
        stage.tileAt(this.x, this.y).walkable.y &&
        stage.tileAt(trailingX, this.y).walkable.y &&
        stage.tileAt(this.x, this.y + this.dir.y * (ts / 2 + this.maxSpeed)).walkable.y
    }
    
    var vx = 0;
    var vy = 0;
    
    if (couldWalk.x && (!couldWalk.y || !this.lastWalkedX)) {
      vx = this.dir.x * this.speed;
      
      if (!stage.tileAt(this.x, this.y).walkable.y) {
        this.lastWalkedX = true;
      }
      
      if (Math.sign(centerDistance.x) != this.dir.x) {
        if (Math.abs(centerDistance.y) > this.speed) {
          vy = Math.sign(centerDistance.y) * this.speed;
        } else {
          this.y += centerDistance.y;
        }
      }
    } else if (couldWalk.y) {
      vy = this.dir.y * this.speed;
      
      if (!stage.tileAt(this.x, this.y).walkable.x) {
        this.lastWalkedX = false;
      }
      
      if (Math.sign(centerDistance.y) != this.dir.y) {
        if (Math.abs(centerDistance.x) > this.speed) {
          vx = Math.sign(centerDistance.x) * this.speed;
        } else {
          this.x += centerDistance.x;
        }
      }
    } else {
      if (this.dir.x || this.dir.y) {
        this.speed *= 0.5;
      }
    }
    
    this.y += vy;
    this.x += vx;
  }
  
  clearSpace() {
    var x = this.originalX;
    var y = this.originalY;
    for (var i = 0; i < 5; i++) {
      var direction = directions[i-1];
      if (i == 0) { direction = {x: 0, y: 0} };
      if (stage.tiles[y+direction.y][x+direction.x].destroyable) {
         stage.tiles[y+direction.y][x+direction.x] = new Tile(0, x+direction.x, y+direction.y);
      }
    }
  }
  
  updateMaxSpeed() {
    var a = 1 / 5;
    var b = 8;
    var modifier = a + (this.speedPower / (b * (1 + a)));
    this.maxSpeed = ts * Math.min(modifier * 0.25, 0.25);
  }
  
  randomizeEmoji() {
    if (!this.hasCrown) {
      var emoji;
      var b = false;
      do {
        b = false;
        emoji = randomEmoji()
        for (var i = 0; i < players.length; i++) {
          var player = players[i];
          if (player.emoji == emoji) {
            b = true;
          }
        }
      } while (b);
      this.emoji = emoji;
      this.emojiModifier = randomEmojiModifier();
    } else {
      this.hasCrown = false;
    }
    this.image = imageFromEmoji(this.emoji + this.emojiModifier);
  }
  
  draw(context) {
    if (!this.joined) { return; }
    
    var offset = Math.floor(Math.floor(this.width / 10));
    var rectSize = {
      width: this.width - offset * 2,
      height: this.height - offset * 2
    }
    
    context.translate(
      Math.round(this.x),
      Math.round(this.y)
    );
    
    if (this.animation.name == "walking") {
      context.rotate((Math.floor(this.animation.frame / 10) * 2 - 1) * 0.015 * (Math.PI * 2));
    }
    
    if (this.dead) {
      context.globalCompositeOperation = "luminosity";
      context.globalAlpha = 0.4;
    }
    
    context.drawImage(this.image, -rectSize.width / 2, -rectSize.height / 2, rectSize.width, rectSize.height);
    
    context.globalCompositeOperation = "source-over";
    context.globalAlpha = 1.0;
    context.resetTransform();
    context.restore();
  }
}

class Object {
  constructor(type, x, y) {
    x = Math.floor(x);
    y = Math.floor(y);
    
    this.type = type;
    this.width = this.height = ts;
    this.x = (x + 0.5) * ts;
    this.y = (y + 0.5) * ts;
    
    if (type == "bomb") {
      this.emoji = allIosEmoji[655];
      this.image = imageFromEmoji(this.emoji + randomEmojiModifier());
      this.countdown = 30 * 3.5;
      this.animation = { frame: 0 };
      this.directions = directions.slice();
    } else if (type == "explosion") {
      this.countdown = 4;
      this.deadly = true;
    } else if (type == "item") {
      this.itemType = (["💣", "👞", "🔥"])[Math.floor(Math.random() * 3)];
      this.image = imageFromEmoji(this.itemType);
      this.animation = { frame: Math.floor(Math.random() * 360) };
    }
    
    objects.push(this);
  }
  
  main() {
    if (this.type == "bomb") {
      this.animation.frame = (this.animation.frame + 1) % 30;
      this.countdown -= 1;
      if (this.countdown <= 0) {
        objects.splice(objects.indexOf(this), 1);
        this.player.bombsAvailable += 1;

        var xpos = Math.floor( this.x / ts );
        var ypos = Math.floor( this.y / ts );
    
        var explosion = new Object("explosion", xpos, ypos);
        explosion.directions = this.directions.slice();
        explosion.strength = this.player.expolosionStrength;
      }
    } else if (this.type == "explosion") {
      if (this.countdown == 0) {
        if (this.strength > 0) {
          for (var i = 0; i < this.directions.length; i++) {
            var direction = this.directions[i];
            var xpos = Math.floor( this.x / ts ) + direction.x;
            var ypos = Math.floor( this.y / ts ) + direction.y;
            
            if (stage.tiles[ypos][xpos].destroyable || stage.tiles[ypos][xpos].type == 0) {
              var existingObject = objectAt(xpos * ts, ypos * ts);
              if (existingObject) {
                if (existingObject.type == "bomb") {
                  existingObject.countdown = 0;
                }
                if (existingObject.type == "item") {
                  objects.splice(objects.indexOf(existingObject), 1);
                  existingObject = false;
                }
              }
              if (!existingObject) {
                var explosion = new Object("explosion", xpos, ypos);
                explosion.directions = [ direction ];
                if (stage.tiles[ypos][xpos].type == 0) {
                  explosion.strength = this.strength - 1;
                }
              }
            }
          }
        }
      } else if (this.countdown < 0) {
        if (this.countdown == -3) {
          var xpos = Math.floor( this.x / ts );
          var ypos = Math.floor( this.y / ts );
          if (stage.tiles[ypos][xpos].destroyable) {
            // Destroy the tile
            stage.tiles[ypos][xpos] = new Tile(0, xpos, ypos);
            // Create a new item
            if (Math.random() < 0.3) {
              var item = new Object("item", xpos, ypos);
            }
          }
        }
        if (this.countdown < -10) {
          objects.splice(objects.indexOf(this), 1);
        }
      }
      this.countdown -= 1;
    }
  }
  
  draw(context) {
    context.translate(
      Math.round(this.x),
      Math.round(this.y)
    );
    
    var radius;
    var color;
    
    if (this.type == "bomb") {
      radius = this.width / 3 + Math.sin(Math.PI * this.animation.frame / 30) * this.width / 15;
      color = this.color;
      
      context.drawImage(this.image, -radius, -radius, radius * 2, radius * 2);
    } else if (this.type == "explosion") {
      if (this.directions.length > 1) {
        radius = this.width / 4 + this.countdown * this.width * 0.01;
        color = "red";
      } else {
        radius = this.width / 5 + this.countdown * this.width * 0.01;
        color = "orange";
      }
    
      context.beginPath();
      context.arc(0, 0, radius, 0, 2 * Math.PI, false);
      context.fillStyle = color;
      context.fill();
    } else if (this.type == "item") {
      radius = Math.floor(this.width / 3);
      
      var color1 = "hsl(" + ((this.animation.frame) % 360) + ", 100%, 90%)";
      var color2 = "hsl(" + ((this.animation.frame + 50) % 360) + ", 100%, 90%)";
      
      var gradient = context.createLinearGradient(0, 0, 0, radius);
      gradient.addColorStop(0, color1);
      gradient.addColorStop(1, color2);
            
      this.animation.frame = (this.animation.frame + 0.8) % 360;
      
      context.beginPath();
      context.arc(0, 0, radius, 0, 2 * Math.PI, false);
      context.fillStyle = gradient;
      context.fill();
      
      radius = Math.floor(radius * 0.7);
      if (this.itemType == "👞") {
        context.rotate(0.25 * Math.PI);
        context.translate(0, -Math.round(radius / 1.8));
      }
            
      context.drawImage(this.image, -radius, -radius, radius * 2, radius * 2);
    }
    
    context.resetTransform();
    context.restore();
  }
}

class Tile {
  constructor(type, x, y) {
    this.type = type;
    this.color = (["#fff", "#334", "#8e643c"])[type];
    if (type == 0) {
      this.walkable = { x: y % 2, y: x % 2 };
    } else {
      this.walkable = { x: false, y: false }
    }
    this.destroyable = (type == 2);
  }
}

class Stage {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    
    this.tiles = [];
    for (var y = 0; y < height; y++) {
      var row = [];
      for (var x = 0; x < width; x++) {
        var tile;
        if (x % (width - 1) == 0 || y % (height - 1) == 0) {
          tile = new Tile(1, x, y);
        } else {
          if (y % 2 || x % 2) {
            if (Math.random() < 0.9) {
              tile = new Tile(2, x, y);            
            } else {
              tile = new Tile(0, x, y);
            }
          } else {
            tile = new Tile(1, x, y);
          }
        }
        row[x] = tile;
      }
      this.tiles[y] = row;
    }
  }
  
  tileAt(x, y) {
    return this.tiles[Math.floor(y / ts)][Math.floor(x / ts)];
  }
  
  draw(context) {
    for (var y = 0; y < this.height; y++) {
      for (var x = 0; x < this.width; x++) {
        context.fillStyle = this.tiles[y][x].color;
        context.fillRect(x * ts, y * ts, ts, ts);
      }
    }
  }
}

function main() {
  var gamepadPressingStart = false;
  var gamepads = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads : []);
  for (var i = 0; i < gamepads.length; i += 1) {
    var gamepad = gamepads[i];
    if (gamepad) {
      if (gamepad.buttons[9].pressed) {
        gamepadPressingStart = true;
      }
    }
  }
  
  if (keyIsDown[32] || gamepadPressingStart) {
    if (readyToStartGame && activePlayers >= 2) {
      readyToStartGame = false;
      
      if (!gameStarted) {
        gameStarted = true;
        document.getElementsByTagName("h1")[0].style.display = "none";
      } else {
        var alive = 0;
        for (var i = 0; i < players.length; i++) {
          var player = players[i];
          if (!player.dead) { alive += 1; }
        }
        if (alive <= 1) {
          restart();
          document.getElementsByTagName("h1")[0].style.display = "block";
        }
      }
    }
  } else {
    readyToStartGame = true;
  }
  
  for (var i = 0; i < objects.length; i++) {
    var object = objects[i];
    object.main();
  }
  
  for (var i = 0; i < players.length; i++) {
    var player = players[i];
    player.main();
  }
  
  draw(context);
}

function draw(context) {
  context.clearRect(0, 0, canvas.width, canvas.height);
  
  stage.draw(context);
  
  for (var i = 0; i < objects.length; i++) {
    var object = objects[i];
    object.draw(context);
  }
  
  var sortedPlayers = players.slice().sort( function(a, b) {
    if (a.dead) { return -1 };
    if (b.dead) { return 1 };
    return a.y - b.y;
  });
  for (var i = 0; i < sortedPlayers.length; i++) {
    var player = sortedPlayers[i];
    player.draw(context);
  }
}

function objectAt(x, y) {
  var xpos = Math.floor( x / ts );
  var ypos = Math.floor( y / ts );
  
  for (var i = 0; i < objects.length; i++) {
    var object = objects[i];
    var objxpos = Math.floor( object.x / ts );
    var objypos = Math.floor( object.y / ts );
    if (objxpos == xpos && objypos == ypos) {
      return object;
    }
  }
}

function restart() {
  gameStarted = false;
  
  stage = new Stage(Math.floor(canvas.width) / ts, Math.floor(canvas.height / ts));
  objects = [];
  
  var winner;
  var hasWinner = true;
  for (var i = 0; i < players.length; i++) {
    var player = players[i];
    
    if (!player.dead && player.joined) {
      player.consecutiveWins += 1;
      if (player.consecutiveWins >= 3) {
        player.image = imageFromEmoji("👑");
        player.hasCrown = true;
      }
    } else {
      player.consecutive = 0;
      if (player.hasCrown) {
        player.hasCrown = false;
        player.image = imageFromEmoji(player.emoji + player.emojiModifier);
      }
    }
    
    player.dead = !player.joined;
    player.x = (player.originalX + 0.5) * ts;
    player.y = (player.originalY + 0.5) * ts;
    
    player.speed = 0;
    player.speedPower = 0;
    player.updateMaxSpeed();
    player.bombsAvailable = 1;
    player.expolosionStrength = 1;
    
    if (player.joined) {
      player.clearSpace();
    }
  }
}

var keyIsDown = [];
window.onkeyup = function(event) { keyIsDown[event.keyCode] = false; }
window.onkeydown = function(event) { keyIsDown[event.keyCode] = true; /*console.log(event.keyCode)*/ }

var objects;
var stage;

var players = [
  new Player(0),
  new Player(1),
  new Player(2),
  new Player(3),
  new Player(4),
  new Player(5),
  new Player(6),
  new Player(7),
  new Player(8),
  new Player(9),
  new Player(10),
  new Player(11),
];
var activePlayers = 0;

var startPositions = [
  {x: 1, y: 1},
  {x: width - 2, y: height - 2},
  {x: width - 2, y: 1},
  {x: 1, y: height - 2},
  
  {
    x: width / 3 - (1 + Math.floor(width / 3) % 2),
    y: height / 2
  },
  {
    x: width * 2 / 3 + (1 + Math.floor(width * 2/ 3) % 2),
    y: height / 2
  },
  
  {
    x: width / 2,
    y: 3
  },
  {
    x: width / 2,
    y: height - 4
  },
  
  {
    x: width / 3 - (Math.floor(width / 3) % 2),
    y: 1
  },
  {
    x: width * 2 / 3 + (Math.floor(width * 2/ 3) % 2),
    y: 1
  },
  
  {
    x: width / 3 - (Math.floor(width / 3) % 2),
    y: height - 2
  },
  {
    x: width * 2 / 3 + (Math.floor(width * 2/ 3) % 2),
    y: height - 2
  },
];

for (var i = 0; i < players.length; i++) {
  players[i].randomizeEmoji();
}

players[0].keys = {
  "left": 65,
  "right": 68,
  "up": 87,
  "down": 83,
  "bomb": 84
}

players[1].keys = {
  "left": 37,
  "right": 39,
  "up": 38,
  "down": 40,
  "bomb": 77
}

imageFromEmoji("💣");
imageFromEmoji("👟");
imageFromEmoji("🔥");

restart();

window.setInterval(main, 1000 / 30);

// Extending existing objects

// https://stackoverflow.com/a/7838871
CanvasRenderingContext2D.prototype.roundedRect = function (x, y, w, h, r) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  this.beginPath();
  this.moveTo(x+r, y);
  this.arcTo(x+w, y,   x+w, y+h, r);
  this.arcTo(x+w, y+h, x,   y+h, r);
  this.arcTo(x,   y+h, x,   y,   r);
  this.arcTo(x,   y,   x+w, y,   r);
  this.closePath();
  return this;
}
