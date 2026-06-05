import { extract } from '@extractus/article-extractor';

async function test() {
  try {
    const article = await extract('https://techcrunch.com/2026/06/04/founders-fund-launches-game-show-starring-sam-altman-palmer-luckey-and-other-tech-elites/');
    console.log(`Title: ${article.title}`);
    console.log(`Content Length: ${article.content ? article.content.length : 0} chars`);
    console.log(article.content.substring(0, 200) + '...');
  } catch (err) {
    console.error(err);
  }
}

test();
