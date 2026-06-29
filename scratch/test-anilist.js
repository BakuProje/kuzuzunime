const { getAniListData } = require('../lib/scraper');

async function run() {
  try {
    // Look up Naruto: Shippuden (ID 1735) to see if "The Last" movie is filtered out of its relations
    const data = await getAniListData('1735');
    console.log("NARUTO SHIPPUDEN RELATIONS:");
    if (data && data.relatedAnime) {
      data.relatedAnime.forEach(rel => {
        console.log(`  - ${rel.title} (ID: ${rel.id}, Type: ${rel.relationType})`);
      });
    } else {
      console.log("No relations found.");
    }
  } catch (err) {
    console.error("Error:", err);
  }
}
run();
