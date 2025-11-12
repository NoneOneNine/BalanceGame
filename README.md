# Balance Game

Jackbox style game of "Would You Rather"

## Local source code setup

Run ```npm install``` to install dependencies.
Run ```node server.js``` to run on localhost:3000

## Heroku deployment

https://balance-game-6967760693ac.herokuapp.com/

## How to play

The starting screen presents two options: Create Room or Join Room

### Creating a Room

Enter a player name first in the empty textbox field and then press the Create Room button

*The user that creates a room is the host of the room. The host is responsible for all controls in-game (e.g. pressing the button for the next question)*

Once a room is created, a new room code is made. All other players may enter this code to join room

### Joining a Room

On the starting screen, a user may instead press the Join Room button

This leads to a screen with two text fields: room code and player name

Enter the appropriate room code (automatically raises characters to uppercase and caps at 4 characters)
and enter the desired player name then press the Join Room button again

### In-Game

Once all players have successfully joined, the host must press the Start Game button (only the host sees this button)

At random, a question is given to a randomly selected player. The player must answer the question with their personal choice

Once this player has answered, all other players must guess which answer was chosen by the original player

Players that successfully guess get a point

At the end of the game, a leaderboard is shown with the top 3 guessers