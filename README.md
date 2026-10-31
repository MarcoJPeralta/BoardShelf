# Boardshelf

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.0.1.

## Setup

The app needs Firebase (Auth and Firestore), Cloudinary and a BoardGameGeek API token. Firebase and Cloudinary keys live in `src/environments/environment.ts` and the BGG token lives in `.dev.vars`. Neither file is committed, and the app won't build without the first:

```bash
npm install
cp src/environments/environment.example.ts src/environments/environment.ts
cp .dev.vars.example .dev.vars
```

Then replace the placeholder values in the new files. The BGG token must never go in `environment.ts`, because that file is compiled into the browser bundle. Games are stored per user at `users/{uid}/games` in Firestore, so your security rules must let each signed-in user read and write their own path.

## Deployment

The app runs on Cloudflare Workers. `worker/index.ts` serves the build and proxies BGG requests for signed-in users, adding the token on the server. `npm run deploy` builds the app and uploads the token from `.dev.vars` as a Worker secret.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
