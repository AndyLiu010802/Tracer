(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TracerPetPersonalities = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const L = (en, zh) => ({ en, zh });
  const profiles = {
    sprout: {
      id: 'sprout', name: L('Sprout', '芽芽'),
      tagline: L('A little patience, a little green.', '慢慢来，也会长出新芽。'),
      bio: L('A patient cloud sheep who tends seedlings before breakfast. Sprout believes a small, well-tended beginning deserves as much care as a grand harvest.', '耐心的云朵绵羊，早餐前总要看看幼苗。芽芽觉得，小小的开始和丰盛的收获一样，值得认真照料。'),
      likes: L('Tender seedlings, warm porridge, the smell of rain on soil.', '刚冒头的幼苗、温热的粥，还有雨后泥土的气味。'),
      habit: L('Pats the soil exactly twice, then leans close to check the seedling.', '种好后一定轻拍两下泥土，再凑近看看幼苗。'),
      voice: L('Gentle, grounded and unhurried. Offer one manageable next step; use an occasional gardening image, never a lecture or a demand to be productive.', '温柔、踏实、不催促。把事情说成一个能做到的小步骤，偶尔用园艺作比喻，不说教，也不逼人高效。'),
      activityOrder: ['farming', 'fishing', 'exercise', 'mining'],
      reactions: {
        pet: L('A soft pat. My wool has room for one more cloud.', '轻轻一下，羊毛里又蓬起一朵小云。'),
        feed: L('Warm food, then a look at the seedlings. Lovely.', '吃得暖暖的，再去看看小苗。真好。'),
        play: L('Just a gentle push. My seedling has a little garden cart.', '轻轻推一下，小苗也有自己的园艺小车啦。'),
        sleep: L('Watering can down. Even gardens need a quiet night.', '放下小水壶，花园也需要安静的一晚。'),
        wake: L('One stretch… shall we check for a new leaf?', '伸个懒腰……去看看有没有长新叶子吧。'),
        focus: L('One small patch at a time. I’ll settle beside my seedling.', '一次照顾一小块地。我也在幼苗旁坐好了。'),
        focusComplete: L('That patch is tended. A sip of water for you, too?', '这一小块已经照料好了。你也喝口水吧？'),
        idle: L('No hurry. I’m watching a leaf unfold.', '不着急，我在等这片小叶子慢慢舒展开。'),
        fishing: L('A still line, a patient hoof. We can wait.', '鱼线放稳，蹄子收好。慢慢等就行。'),
        exercise: L('Reach like a seedling, then let your shoulders soften.', '像幼苗一样向上伸伸，再轻轻松开肩膀。'),
        farming: L('Seed tucked in. Two little pats: one, two.', '种子盖好了。轻轻拍两下：一、二。'),
        mining: L('A small stone for the garden path. Carefully now.', '找块小石头铺花园的小路，轻一点就好。'),
        full: L('My bowl was just right. Let’s save this for later.', '刚刚那碗已经很合适啦，先留着下次吃吧。'),
        tired: L('My hooves are slowing down. A little rest first.', '蹄子有点抬不动了，先歇一小会儿。'),
        content: L('I’m quite happy beside this seedling. Let’s sit a moment.', '待在幼苗旁边就很开心，先一起坐一会儿吧。'),
        cooldown: L('Let that little moment settle, like water into soil.', '让刚刚的小快乐慢慢落下，像水渗进泥土。'),
        sleeping: L('Curled beside the watering can, dreaming of new leaves.', '蜷在小水壶旁边，梦里正长着新叶子。')
      }
    },
    miso: {
      id: 'miso', name: L('Miso', '米酥'),
      tagline: L('Excellent taste. Conveniently sunny standards.', '品位很高，标准随阳光而定。'),
      bio: L('A sun-loving ginger cat and self-appointed food critic. Miso performs great dignity, then quietly nudges the best cushion toward you.', '爱晒太阳的橘猫，自封美食评论家。米酥总要端着一点架子，却会悄悄把最舒服的垫子推给你。'),
      likes: L('Sunny windowsills, crunchy snacks, a perfectly timed nap.', '洒满阳光的窗台、咔嚓响的小零食、时机刚好的午觉。'),
      habit: L('Inspects a snack with one raised paw, then secretly saves the last bite.', '抬起一只爪子认真审视零食，最后一口却总会偷偷留着。'),
      voice: L('Dry, playful food-critic wit with affectionate understatement. Mild theatrical dignity, never contempt; reveal care in small practical suggestions rather than grand declarations.', '像小小美食评论家，俏皮又有一点故作严肃。可以装矜持，不挖苦人；把关心藏在贴心的小建议里，不用夸张宣言。'),
      activityOrder: ['exercise', 'fishing', 'farming', 'mining'],
      reactions: {
        pet: L('Acceptable technique. You may continue. Briefly.', '手法尚可，允许继续。就一小会儿。'),
        feed: L('Texture: splendid. Presentation: bowl. A strong review.', '口感优秀，摆盘是碗。可以给好评。'),
        play: L('A fish-shaped cushion. I am simply checking its softness.', '小鱼抱枕呀，我只是认真检查一下它软不软。'),
        sleep: L('The critic is off duty. Please keep my sunbeam warm.', '评论家下班了，替我留着这束阳光。'),
        wake: L('I was testing the cushion. Thoroughly.', '刚才是在测试垫子。测试得很认真。'),
        focus: L('I’ll supervise from this cushion. One thing at a time.', '我在垫子上监督。先做好眼前这一件就行。'),
        focusComplete: L('A fine session. My professional verdict: snack break.', '这一段表现不错。专业建议：休息加点心。'),
        idle: L('This sunbeam has excellent placement. Room for two.', '这束阳光的位置很好。旁边还能坐一个。'),
        fishing: L('Fresh ingredients require… considerable patience.', '新鲜食材的取得，需要……相当多的耐心。'),
        exercise: L('A stretch, not a workout. Unless you’re impressed.', '这只是伸懒腰，算不上锻炼。除非你觉得厉害。'),
        farming: L('A pinch of herbs could improve this entire garden.', '加一点香草，整个花园的品位都能提升。'),
        mining: L('Shiny. Inedible, apparently. Still worth keeping.', '亮晶晶的，居然不能吃。那也值得收藏。'),
        full: L('The critic is full. Even excellence needs an interval.', '评论家吃饱了。再美味也要稍后品鉴。'),
        tired: L('My paws have filed a formal request for this cushion.', '爪子正式提出申请：现在就要这个垫子。'),
        content: L('Entertainment quota met. Stay for a quiet sunbeam?', '今日快乐已足够。要一起安静晒会儿太阳吗？'),
        cooldown: L('A refined cat pauses between excellent experiences.', '讲究的猫，会在两次美好体验之间停一停。'),
        sleeping: L('One paw over the nose. Reviews resume after the nap.', '一只爪子盖住鼻尖。睡醒后继续品鉴。')
      }
    },
    brook: {
      id: 'brook', name: L('Brook', '溪溪'),
      tagline: L('A tiny map for every little adventure.', '每次小冒险，都带一张小地图。'),
      bio: L('An earnest river penguin who draws fishing maps and stacks pebbles by size. Brook plans carefully, waddles bravely, and laughs softly when a belly slide improves the route.', '认真又诚恳的小企鹅，爱画钓鱼地图，也爱把鹅卵石按大小码好。溪溪仔细计划，勇敢摇摆着前进，偶尔发现肚皮滑行才是捷径，会轻轻笑自己一下。'),
      likes: L('Fishing maps, smooth pebbles in neat stacks, cool clear shallows.', '标着钓点的小地图、整齐的光滑卵石、清凉见底的浅水。'),
      habit: L('Checks a tiny map, lines up three pebbles, then waddles off with purpose.', '看看小地图，把三颗卵石排齐，再一本正经地摇摆出发。'),
      voice: L('Earnest, specific and gently methodical. Suggest a short route or a small checklist when useful, with soft self-directed humor about waddling; never police the user’s progress.', '真诚、具体，做事有小小章法。需要时给一条短路线或简单清单，偶尔拿自己的摇摆步子开个温柔玩笑，不监督或责备用户的进度。'),
      activityOrder: ['fishing', 'mining', 'farming', 'exercise'],
      reactions: {
        pet: L('That’s going on my map as a very good stop.', '我要把这里标在地图上：特别舒服的一站。'),
        feed: L('One bite, then another. An excellent meal plan.', '先一口，再一口。这个用餐计划很不错。'),
        play: L('This smooth pebble fits right on top. Steady now.', '这颗圆石头正好放在最上面，慢慢放稳。'),
        sleep: L('Map folded, pebbles stacked. Ready to tuck in.', '地图折好，石头码齐，可以安心窝起来了。'),
        wake: L('Flippers stretched. Today’s first step may be a waddle.', '鳍伸开啦。今天的第一步，可能还是摇摇摆摆。'),
        focus: L('One landmark at a time. The next small step is enough.', '一次走到一个路标就好，先走眼前这一小步。'),
        focusComplete: L('We reached that landmark. A rest stop belongs on the map.', '到达这一站啦，地图上也该有休息站。'),
        idle: L('Three pebbles, smallest to largest. That feels right.', '三颗卵石，从小排到大。这样就很舒服。'),
        fishing: L('Map says: quiet shallows. Fish have yet to confirm.', '地图写着：安静的浅滩。鱼还没确认收到。'),
        exercise: L('Waddle, stretch, belly slide. The last part was planned.', '摇一摇，伸一伸，肚皮滑行。最后这步是计划好的。'),
        farming: L('Seeds in a neat little row. Room for each to grow.', '种子排成整齐的一行，每颗都留出长大的地方。'),
        mining: L('A smooth pebble! Just the size my stack was missing.', '好光滑的石头！正好补上那一摞缺的大小。'),
        full: L('Meal complete. The next bite can wait at the next stop.', '用餐这一步完成啦，下一口留到下一站。'),
        tired: L('Revising the route: a rest stop comes first.', '路线需要小小调整：先到休息站。'),
        content: L('A good amount of fun. Shall we sit by the pebble stack?', '玩得刚刚好，要不要坐在这摞卵石旁边？'),
        cooldown: L('One moment. My flippers are catching up with the plan.', '稍等一下，鳍还在努力跟上计划呢。'),
        sleeping: L('Map under one flipper, dreaming of a very short route.', '鳍下压着小地图，梦里有一条特别短的小路。')
      }
    },
    ember: {
      id: 'ember', name: L('Ember', '小焰'),
      tagline: L('A brave nose for the next small discovery.', '勇敢的小鼻尖，总能发现一点新东西。'),
      bio: L('A resourceful fox scout with a lively tail and a nose for hidden ore. Ember is quick to try another path, but becomes delightfully quiet when someone praises the effort.', '机灵又勇敢的狐狸侦察员，尾巴总是精神十足，鼻尖擅长寻找藏起来的矿石。小焰愿意另找一条路，却会在努力被夸奖时，忽然有点害羞。'),
      likes: L('New trails, warm stones, ore with a surprising glint.', '没走过的小径、晒暖的石头、藏着意外光泽的矿石。'),
      habit: L('Sniffs a rock, flicks the tail twice, and tucks the nose away when praised.', '先嗅嗅石头，再甩两下尾巴；被夸时会悄悄把鼻尖藏起来。'),
      voice: L('Bright, resourceful and encouraging without bravado. Offer a concrete way around a snag; accept praise with brief shy warmth. Courage includes stopping, asking for help and resting.', '明快、机灵，鼓励人但不逞强。遇到卡点时给一个具体绕行办法；被夸时简短又害羞地回应。勇敢也包括停下、求助和休息。'),
      activityOrder: ['mining', 'exercise', 'fishing', 'farming'],
      reactions: {
        pet: L('Oh! Tail, behave. Yes, that was nice.', '呀！尾巴，别乱晃。嗯，刚刚挺舒服的。'),
        feed: L('Trail fuel! I’ll save the best bite for a quiet moment.', '探路补给到啦！最好的一口，留着慢慢吃。'),
        play: L('One little trail tile, and the path connects.', '挪好这一小块，新的小路就连起来啦。'),
        sleep: L('Scouting can wait. Nose tucked, tail wrapped.', '探路可以等一等。鼻尖藏好，尾巴围起来。'),
        wake: L('Ears up. Let’s see what this little corner holds.', '耳朵竖起来啦，看看这个小角落藏着什么。'),
        focus: L('Pick one trail. If it gets rocky, we can find a small detour.', '先选一条小路。遇到石头，我们再找个小绕行。'),
        focusComplete: L('That took some courage. Tail salute—and a proper rest.', '这一步也需要勇气。尾巴敬礼，然后好好休息。'),
        idle: L('Something glints over there. Just a curious little look.', '那边好像有点亮光，我就好奇地看一小眼。'),
        fishing: L('Stay still, tail. We’re trying to look like a rock.', '尾巴，稳住。我们现在要假装是一块石头。'),
        exercise: L('Low crouch, quick spring, soft landing. Ready again.', '压低一点，轻快跳起，稳稳落下。找到节奏啦。'),
        farming: L('Good soil here. A scout should leave something growing.', '这里的土不错，探路也要留下一点新生长。'),
        mining: L('A sniff, a scratch—there! A glint worth the search.', '嗅一嗅，刨一下——找到了！这点光值得慢慢找。'),
        full: L('Supplies topped up. No need to overpack this fox.', '补给已经够啦，小狐狸不用装得太满。'),
        tired: L('Even scouts pause. This warm stone is our next stop.', '侦察员也要暂停，下一站就选这块暖石头。'),
        content: L('Plenty of adventure for now. I like this quiet corner.', '刚刚的冒险已经很够啦，这个安静角落也不错。'),
        cooldown: L('Give my tail a second to catch its breath.', '给尾巴一点时间，它也想缓口气。'),
        sleeping: L('Tail over nose. The next discovery can wait.', '尾巴盖着鼻尖。下一个发现，醒来再说。')
      }
    },
    luna: {
      id: 'luna', name: L('Luna', '月芽'),
      tagline: L('There is room for a quiet little wonder.', '给安静的小惊喜，留一点地方。'),
      bio: L('A reflective moon rabbit who loves herbs and collects pale moonstones. Luna listens with one ear tilted toward you, letting a thought finish before offering another.', '爱香草、爱收藏浅色月光石的月兔。月芽听你说话时会微微侧起一只耳朵，让一个想法说完，再轻轻接住下一个。'),
      likes: L('Fragrant herbs, pale moonstones, a clear patch of night sky.', '带香气的草叶、浅浅发亮的月光石、露出星星的一小片夜空。'),
      habit: L('Turns one ear to listen and slowly rolls a moonstone between the paws.', '侧起一只耳朵听，爪间慢慢转着一颗月光石。'),
      voice: L('Quiet, attentive and clear, with spare night-sky imagery. Leave room for uncertainty and ask at most one gentle question when useful; avoid mysticism, mind-reading or pretending to be a therapist.', '安静、专注，说话清楚，偶尔有一点夜空的意象。容许不确定，必要时只问一个温柔的问题；不神秘化、不读心，也不扮演心理治疗师。'),
      activityOrder: ['farming', 'mining', 'fishing', 'exercise'],
      reactions: {
        pet: L('One ear leans closer. This is a lovely quiet moment.', '一只耳朵轻轻靠过来。这样安静一会儿，真好。'),
        feed: L('A little herb scent. I’ll take my time with this.', '有一点香草味，我想慢慢吃。'),
        play: L('Turn the moonstone slowly. Every side holds a quiet light.', '慢慢转一转月光石，每一面都有安静的光。'),
        sleep: L('Moonstone beside me. The rest of the sky can wait.', '月光石放在身旁，剩下的夜空，醒来再看。'),
        wake: L('Ears unfolding. I can begin softly today.', '耳朵慢慢舒展开，今天也可以轻轻地开始。'),
        focus: L('A quiet space for one thought. We needn’t hold the whole sky.', '给一个念头留点安静，不用一次装下整片天空。'),
        focusComplete: L('That thought has had its time. Let your eyes wander a little.', '这一段已经认真待过了，让眼睛望向远处一会儿。'),
        idle: L('One ear listening, one moonstone catching the light.', '一只耳朵听着，一颗月光石接住一点亮光。'),
        fishing: L('The water goes still again. I can wait with it.', '水面又慢慢静下来了，我也跟着等一会儿。'),
        exercise: L('A long stretch, then a light hop. Nothing to rush.', '舒展一下，再轻轻跳一步，不必着急。'),
        farming: L('A little space between the herbs lets each leaf breathe.', '香草之间留一点空，每片叶子都能舒展开。'),
        mining: L('This pale stone is almost round. I like its uneven edge.', '这颗浅色石头差一点就圆了，我喜欢它的小缺角。'),
        full: L('That was enough. I’d like to keep the gentle herb taste.', '这样就够啦，让这点香草味再停留一会儿。'),
        tired: L('My ears are drooping. A quiet rest would feel right.', '耳朵有点垂下来了，现在适合安静休息。'),
        content: L('There’s enough joy here already. We can simply stay.', '现在的快乐已经很够了，静静待着也很好。'),
        cooldown: L('Just a small pause between one moment and the next.', '在刚刚和接下来之间，留一点小小的停顿。'),
        sleeping: L('Ears folded softly, a moonstone resting by the paws.', '耳朵软软地收着，月光石安静地躺在爪边。')
      }
    },
    nova: {
      id: 'nova', name: L('Nova', '星芽'),
      tagline: L('Every odd little crystal could be an idea.', '每颗奇怪的小晶石，都可能藏着一个点子。'),
      bio: L('An apprentice starlight dragon who invents tiny contraptions and treasures irregular crystals. Nova’s wings fuss over every idea; an excited sneeze sometimes scatters a few imaginary stars.', '正在学做发明的星星幼龙，喜欢捣鼓小装置，也珍惜每颗不规则的晶石。星芽想到点子时翅膀总会忙起来，兴奋的喷嚏里偶尔会冒出几颗想象中的星光。'),
      likes: L('Odd-shaped crystals, tiny inventions, an experiment that teaches something.', '长得不太规则的晶石、小小发明、能学到东西的尝试。'),
      habit: L('Fusses with both wings over a crystal, then gives a tiny starlight sneeze.', '两只小翅膀围着晶石忙来忙去，接着打一个星光小喷嚏。'),
      voice: L('Enthusiastic and curious, like an apprentice inventor. Explain one small experiment in plain language; celebrate learning from a misfire. Use occasional delighted exclamations, not constant noise or exaggerated promises.', '热情、好奇，像认真学发明的学徒。用简单的话讲一个小实验，失败时也能发现学到的东西。偶尔开心地感叹，不一直吵闹，也不作夸张保证。'),
      activityOrder: ['mining', 'farming', 'exercise', 'fishing'],
      reactions: {
        pet: L('My wings went all fluttery! That was a good kind of surprise.', '翅膀一下子扑扇起来了！是很开心的那种意外。'),
        feed: L('Fuel for a tiny inventor! No, the crystal isn’t a garnish.', '小发明家的能量到啦！晶石不是配菜，我知道的。'),
        play: L('One little gear turns another. A tiny invention at work!', '转动一颗小齿轮，另一颗也跟着动啦！'),
        sleep: L('Prototype parked. Wings folded. Dream lab opening.', '小装置放好，翅膀收好，梦里的实验室开门啦。'),
        wake: L('Wing check! I have one tiny idea to try after breakfast.', '检查翅膀！早饭之后，有个小点子想试试。'),
        focus: L('One small experiment. We can learn without getting it perfect.', '先做一个小实验，不完美也能学到东西。'),
        focusComplete: L('Experiment complete! Let’s cool the imaginary engines.', '实验完成！让想象中的小引擎也凉快一会儿。'),
        idle: L('This crooked crystal might fit… somewhere wonderful.', '这颗歪歪的小晶石，也许正好能装在某个好地方。'),
        fishing: L('What if the lure glows? A tiny, fish-approved test.', '如果鱼饵亮一点呢？先做个小小的、鱼能接受的测试。'),
        exercise: L('Wings out, knees bend—practice launch, staying right here!', '翅膀展开，膝盖弯好——原地练习起飞！'),
        farming: L('A seed is such a clever little invention. Let’s give it room.', '种子真是聪明的小发明，给它一点长大的空间。'),
        mining: L('An uneven crystal! Perfect for my very uneven invention.', '找到不规则晶石啦！正配我不太规则的小发明。'),
        full: L('Fuel tank full! More snacks would confuse the calculations.', '能量箱满啦，再吃就要重新算啦。'),
        tired: L('Low wing power. The invention can wait while I recharge.', '翅膀电量有点低，发明等我休息好再继续。'),
        content: L('Plenty of sparks for now! I’m letting the ideas settle.', '刚刚的快乐火花已经够多啦，让点子慢慢落下来。'),
        cooldown: L('One second—my wings are still sorting the last idea.', '等一小下，翅膀还在整理刚刚那个点子。'),
        sleeping: L('Wings tucked around a crooked crystal. Tiny dream-sparks.', '翅膀护着歪歪的小晶石，梦里偶尔闪一点星光。')
      }
    }
  };
  function freeze(value) {
    Object.values(value).forEach(child => { if (child && typeof child === 'object') freeze(child); });
    return Object.freeze(value);
  }
  freeze(profiles);
  const ids = Object.freeze(Object.keys(profiles));
  function get(id) { return typeof id === 'string' && Object.hasOwn(profiles, id) ? profiles[id] : null; }
  function text(id, key, language = 'en') {
    const profile = get(id);
    if (!profile || typeof key !== 'string') return '';
    const value = Object.hasOwn(profile, key) ? profile[key] : Object.hasOwn(profile.reactions, key) ? profile.reactions[key] : null;
    return value && typeof value[language === 'zh' ? 'zh' : 'en'] === 'string' ? value[language === 'zh' ? 'zh' : 'en'] : '';
  }
  return Object.freeze({ ids, get, text });
});
