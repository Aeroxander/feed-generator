import { createDb } from './src/db';
import { postUriToContentId } from './src/services/score-sync';
const db = createDb('db.sqlite');
async function run() {
  const posts = await db.selectFrom('post').select(['uri']).execute();
  const ponderCids = [
    '0x49d511659741a468b4b90f9b686dd20e98ca6e95aed828dc02a2030ee1532485',
    '0x2e7e831568f0d4baf5fd77438fb34e0ef6ac0cc63dc23dd0a7a32a03e64368ec'
  ];
  let found = 0;
  for (const post of posts) {
    if (ponderCids.includes(postUriToContentId(post.uri))) {
      console.log('Found post in DB!', post.uri);
      found++;
    }
  }
  console.log(`Found ${found} matching posts.`);
}
run();
