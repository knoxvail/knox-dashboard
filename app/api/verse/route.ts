import { NextResponse } from "next/server";

export const revalidate = 86400; // cache 24 hours

// Curated list of substantive verses — rotates by day of year
const VERSES = [
  { ref: "Romans 8:28", text: "And we know that in all things God works for the good of those who love him, who have been called according to his purpose." },
  { ref: "Philippians 4:13", text: "I can do all this through him who gives me strength." },
  { ref: "Proverbs 3:5-6", text: "Trust in the Lord with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight." },
  { ref: "Isaiah 40:31", text: "But those who hope in the Lord will renew their strength. They will soar on wings like eagles; they will run and not grow weary, they will walk and not be faint." },
  { ref: "Joshua 1:9", text: "Have I not commanded you? Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God will be with you wherever you go." },
  { ref: "Jeremiah 29:11", text: "For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you, plans to give you hope and a future." },
  { ref: "Matthew 6:33", text: "But seek first his kingdom and his righteousness, and all these things will be given to you as well." },
  { ref: "Psalm 46:1", text: "God is our refuge and strength, an ever-present help in trouble." },
  { ref: "2 Timothy 1:7", text: "For the Spirit God gave us does not make us timid, but gives us power, love and self-discipline." },
  { ref: "Colossians 3:23", text: "Whatever you do, work at it with all your heart, as working for the Lord, not for human masters." },
  { ref: "Romans 12:2", text: "Do not conform to the pattern of this world, but be transformed by the renewing of your mind. Then you will be able to test and approve what God's will is." },
  { ref: "Psalm 23:1", text: "The Lord is my shepherd, I lack nothing." },
  { ref: "John 16:33", text: "In this world you will have trouble. But take heart! I have overcome the world." },
  { ref: "Ephesians 2:10", text: "For we are God's handiwork, created in Christ Jesus to do good works, which God prepared in advance for us to do." },
  { ref: "1 Corinthians 10:31", text: "So whether you eat or drink or whatever you do, do it all for the glory of God." },
  { ref: "Micah 6:8", text: "He has shown you, O mortal, what is good. And what does the Lord require of you? To act justly and to love mercy and to walk humbly with your God." },
  { ref: "Psalm 27:1", text: "The Lord is my light and my salvation — whom shall I fear? The Lord is the stronghold of my life — of whom shall I be afraid?" },
  { ref: "Galatians 6:9", text: "Let us not become weary in doing good, for at the proper time we will reap a harvest if we do not give up." },
  { ref: "Proverbs 16:3", text: "Commit to the Lord whatever you do, and he will establish your plans." },
  { ref: "Romans 5:3-4", text: "We also glory in our sufferings, because we know that suffering produces perseverance; perseverance, character; and character, hope." },
  { ref: "Hebrews 12:1", text: "Therefore, since we are surrounded by such a great cloud of witnesses, let us throw off everything that hinders and the sin that so easily entangles, and let us run with perseverance the race marked out for us." },
  { ref: "John 15:5", text: "I am the vine; you are the branches. If you remain in me and I in you, you will bear much fruit; apart from me you can do nothing." },
  { ref: "Psalm 37:4", text: "Take delight in the Lord, and he will give you the desires of your heart." },
  { ref: "Lamentations 3:22-23", text: "Because of the Lord's great love we are not consumed, for his compassions never fail. They are new every morning; great is your faithfulness." },
  { ref: "Philippians 4:6-7", text: "Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God. And the peace of God, which transcends all understanding, will guard your hearts and your minds in Christ Jesus." },
  { ref: "Isaiah 43:1", text: "Do not fear, for I have redeemed you; I have summoned you by name; you are mine." },
  { ref: "1 Peter 5:7", text: "Cast all your anxiety on him because he cares for you." },
  { ref: "Psalm 121:1-2", text: "I lift up my eyes to the mountains — where does my help come from? My help comes from the Lord, the Maker of heaven and earth." },
  { ref: "Matthew 11:28", text: "Come to me, all you who are weary and burdened, and I will give you rest." },
  { ref: "Deuteronomy 31:6", text: "Be strong and courageous. Do not be afraid or terrified because of them, for the Lord your God goes with you; he will never leave you nor forsake you." },
  { ref: "Romans 8:37", text: "No, in all these things we are more than conquerors through him who loved us." },
  { ref: "Psalm 16:8", text: "I keep my eyes always on the Lord. With him at my right hand, I will not be shaken." },
  { ref: "2 Corinthians 12:9", text: "But he said to me, My grace is sufficient for you, for my power is made perfect in weakness." },
  { ref: "James 1:2-4", text: "Consider it pure joy, my brothers and sisters, whenever you face trials of many kinds, because you know that the testing of your faith produces perseverance." },
  { ref: "Psalm 118:24", text: "This is the day the Lord has made; we will rejoice and be glad in it." },
  { ref: "John 14:6", text: "Jesus answered, I am the way and the truth and the life. No one comes to the Father except through me." },
];

export async function GET() {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  const verse = VERSES[dayOfYear % VERSES.length];
  // Return both the daily verse and all verses for manual cycling
  return NextResponse.json({ verse, allVerses: VERSES, dayOfYear });
}
