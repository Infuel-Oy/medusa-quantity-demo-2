Steps to test quantity functionality in this project:
```
yarn install
yarn docker:up
npx medusa exec ./src/scripts/test-quantity.ts
```

If you need to login to store at http://localhost:9000/app you can add test user:
```
docker compose run --rm medusa npx medusa user -e admin@example.com -p supersecret
```
