## Prerequisites

### Install Node.js tools, if you haven't already

We're going to use the Node Package Manager (or NPM) to get more tools to make the process of building our project easier.

Visit [https://nodejs.org/](https://nodejs.org).

Download the version with "LTS" next to the number and install it. (LTS stands for Long Term Support, if you're curious.) You do not need to install any additional tools for Native compilation.

### Install Visual Studio Code, if you haven't already

Visit the [Visual Studio Code website](https://code.visualstudio.com) and install Visual Studio Code.

### Other Commands

To setup local deployment for development:

```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   npm run local-deploy -- --watch
```

To run a lint operation (that is, scan your code for errors) use this shortcut command:

```powershell
   npm run lint
```

To auto-fix lint issues, you can use this:

```powershell
   npm run lint -- --fix
```

To create an addon file you can share, run:

```powershell
   npm run mcaddon
```

To create a production version of your code (i.e. with `dev:` labels stripped), run:

```
  npm run build:production
```

To create a production (i.e. with `dev:` labels stripped) addon file you can share, run:

```
  npm run mcaddon:production
```
