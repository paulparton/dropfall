## Goal
This overall goal is to ensure Dropfall is well written to optimise for performance easier maintenance by AI. Some of the next features will be getting the online multiplayer working, adding more stages, and adding arena mode where more than two players can join a game. We want the core game to be ready to support these changes.
### Typescript
Update the dropfall game to written in typescript with good type safety and test coverage. 
### Libraries / frameworks / tools
Review all of our chosen tools and decide if we need to add / remove / replace anything
### Project structure
The code should be organised into a known best practice structure matching the libraries / frameworks / conventions that will work best for this project.
### Performance and reliability
Currently there are a few issues like the music sometimes doesn't play, or it will start playing after a few games and sometimes the game gets a bit jumpy. I don't want you hunting and fixing these issues specifically, but the update structure that you are working on should help in isolating these sorts of issues so you can find and fix them later. Right now its common that an AI will fix one issue, then something else breaks, or a menu disappears, I also don't want you specifically looking to fix any of this, its just an example of how fragile the current structure seems to be. 