import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Token 论 | Tokenizer Hub",
  description: "一篇拟桑弘羊口吻的今体政论，论 Token、Agent 与智能时代的治理。",
};

const tokenLunParagraphs = [
  "或问曰：今之所谓 Token 者，何物也？曰：非钱也，亦钱也；非券也，亦券也；非符节也，亦符节也。昔者盐铁在山泽，布帛在郡国，铜钱在少府；今则算力在云端，模型在重器，数据在民间，权限在链上。盐铁可铸兵农之器，Token 可役智能之劳。故曰：Token 者，数字山泽之盐铁，现实游戏之点券也。",
  "夫天下熙熙，皆为利来；天下攘攘，皆为利往。此非末世之病，乃人情之常。人有欲，则市生；市既生，则权重者居其冲，资厚者据其津。昔富商大贾专山泽之饶，役贫民，通关梁，阴操谷帛之价；今巨室豪族专算力之饶，役 Agent，通 API，阴操注意、信用、流量与身份之价。其名虽异，其势一也。",
  "今之 AI，初为问答之器，继为百工之佐，又继为流程之吏，至于自主之 Agent，则能奉令而行，代人收发、检索、议价、订票、移账、签约、交涉。往者人以钱买物，今将以 Token 买事；往者富人买马、买田、买童仆，今之富人买算力、买代理、买通道、买优先级。是故 AI 既成，天下乃复有一问：有钱者，钱当何所用？答曰：钱将化为 Token，Token 将化为命令，命令将化为现实中被执行的事。",
  "夫 Token 之为物，有四端。一曰通行。凡数字之国，皆有关津。模型有调用之关，数据有访问之关，平台有接口之关，城市有服务之关。不得其 Token，则虽有万金，不得入其门；得其 Token，则一令而百端皆应。昔使者持节，可过郡国；今 Agent 持 Token，可过系统。",
  "二曰役使。人之力有限，Agent 之力可并行。富者昔以粟养客三千，今以 Token 养 Agent 三千。三千 Agent，各为其主问价、投标、谈判、舆论、研发、交易、审计、避险。于是贫者一身对世界，富者千身对世界。若无制度，则 Token 非点券，乃新贵族之符玺也。",
  "三曰度量。世之最难者，非无物也，乃不可计也。注意不可计，信任不可计，模型劳动不可计，数据贡献不可计，Agent 之间相互调用之劳不可计。Token 出，则一切可铢两之。谁贡献语料，谁提供算力，谁担保身份，谁承担风险，皆可记功而受券。此非徒利商贾，亦所以使隐功显、微劳著也。",
  "四曰聚敛。凡可度量者，即可征；凡可通行者，即可榷；凡可役使者，即可制。故 Token 若散在豪右，则豪右得天下之利；Token 若尽归官府，则官府病于迟钝；Token 若无名无籍，则奸人得以逃税、洗钱、惑众、夺民。治 Token 之难，不在知其为币，而在知其为权。",
  "文学之士曰：Token 者，虚妄之物也。无土木之实，无菽粟之用，徒使富者相与鼓吹，贫者趋利而失业，少年沉溺于投机，商贾因链上之名行割取之实。国家若又从而官营，是与民争利也。",
  "桑子曰：不然。盐无礼义，然无盐则民病；铁无仁义，然无铁则农困。Token 亦然。其为善为恶，不在 Token，而在谁制其关、谁收其利、谁担其责。今若听其自流，则外邦巨室先据模型之津，平台豪强先据数据之泽，金融贵人先据发行之权。彼将以去中心之名，行新中心之实；以民主金融之名，设贵宾之门；以治理投票之名，售权力之券。富者锁币六月，便得近侍之门；贫者刷屏十年，犹不得一问。此岂自由？此乃无冠之封建也。",
  "其一，谁可发？发 Token 者，实发信用也。信用若无本，券即空文；信用若私藏，券即豪门门票。国家不可尽发天下之 Token，亦不可不管关键之 Token。凡关乎基础模型、公共身份、城市服务、能源算力、医疗教育、跨境结算者，皆不可使一姓一家一平台独专。",
  "其二，何所锚？无锚之 Token，今日以梦为价，明日以恐惧为价。可锚算力，可锚碳额，可锚带宽，可锚公共服务，可锚 Agent 的可验证劳动。锚不在金银，而在现实可兑之事。不能兑事者，是筹码；能兑事者，方是点券。",
  "其三，何以税？昔盐铁之利入少府，则兵食可给；今 Token 之利若尽入交易所、基金、豪门钱包，则国家见其热闹而不得其用。Token 之税，不当重在劫小民买卖之末，而当重在发行、做市、特权访问、跨境清算、Agent 大规模调用之本。小民偶得其利，不足病也；豪右据其津梁而不输公用，乃大病也。",
  "其四，何以平准？Token 市若风火，涨则万人趋之，跌则万人哭之。昔有平准，以丰时籴、歉时粜，使万物不得腾踊；今亦当有数字平准：对系统性 Token，设储备、披露、熔断、审计、赎回与责任准备。凡号称稳定者，必有稳定之粮；凡号称治理者，必有治理之责；凡号称公共者，必有公共之账。",
  "其五，何以防豪强？昔豪强专山泽，国不能令；今豪强专数据、专模型、专入口、专身份、专 Agent 生态，国亦未必能令。若任其以 Token 封赏门客、收买渠道、操纵舆论、冻结异己、绕开税法，则天下虽无诸侯之名，已有诸侯之实。故 Token 之治，首在反垄断，次在可审计，再在可迁移。用户之身份、余额、声誉、Agent 记忆，不可尽为一平台奴籍。",
  "或曰：如此则国将尽收天下 Token 而官营乎？曰：非也。盐铁之政，贵在知其所当榷，而非万物皆榷。凡百姓小额通用之 Token，宜轻其征、便其用；凡创新试验之 Token，宜宽其路、明其罪；凡平台积分之 Token，宜许其生灭，不必皆入庙堂。惟其关乎国家算力、公共信用、跨境清算、身份认证、战略数据、Agent 大规模执行者，不可无国之手。国之手，不必皆为官铺，可为标准、为审计、为底账、为最后兑付、为反垄断之剑。",
  "故今日若设中石油、中石化之类于 Token，不当名曰某某币司，而当名曰国家算券与智能服务总枢。其职有三：一掌基础算力之券，使公私皆得公平调用；二掌公共 Agent 之券，使教育、医疗、司法、政务、救灾不为豪门所先；三掌跨平台清算之券，使民之数字身份与劳动贡献，不被平台割据。如此，则 Token 不为赌桌筹码，而为国民调用智能世界之通行凭据。",
  "然又不可不戒。官营若无竞争，则券成衙门批条；审计若无公开，则链成黑箱账簿；平准若无边界，则创新尽死；监管若无技术，则只剩口号。Token 之政，最忌二端：一曰全禁，以无知拒未来；二曰全放，以自由媚豪强。全禁则外人先成其业，我独闭关；全放则豪强先据其利，民受其害。善治者，执其中：使 Token 可用、可税、可审、可退、可转、可责。",
  "昔人谓农为本、商为末。今则本末又变。算力为田，模型为牛，数据为种，Agent 为吏，Token 为符节。无算力，则田瘠；无模型，则牛羸；无数据，则种劣；无 Agent，则吏惰；无 Token，则符节不行，百事不得其门。是故今日之富国，不独在仓廪，不独在金银，而在能否把数字之力化为现实之事，把现实之事纳入可治理之账。",
  "至于富人何以花钱？曰：彼将不复只买游艇、宫室、名画、球队，而买更快的认知、更早的情报、更多的 Agent、更深的通道、更高的优先级。若制度不立，则富人购买的不是服务，而是时间本身；不是便利，而是世界响应他的速度。贫者排队，富者插队；贫者发问，富者命令；贫者使用软件，富者调度现实。于是社会之差距，不复只是钱包之差距，而是现实刷新率之差距。",
  "故 Token 之论，终归一义：不可使现实世界的点券，只成为少数玩家的氪金入口。明主之制 Token，当使其上足以强国，中足以节豪，下足以便民。上足以强国，则边疆、科研、灾备、教育、医疗皆有智能之助；中足以节豪，则平台不得私铸关津，巨室不得代币封侯；下足以便民，则小民亦可用少许 Token 召一 Agent，为其问病、办证、学艺、售货、申诉、求职。",
  "如此，则 Token 不乱天下，而通天下；不夺民利，而计民功；不纵豪强，而平其势；不废市场，而正其名。昔盐铁之争，争山泽之利归谁；今 Token 之争，争智能时代之门归谁。门在豪强，则天下为客；门在官僚，则天下为吏；门在公制而可通，则天下始为民。",
];

export default function TokenLunPage() {
  return (
    <main className="token-lun-page min-h-screen overflow-x-hidden bg-[#f4ead8] px-4 py-5 text-[#241b12] sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(164,88,42,0.12),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(112,78,41,0.08),transparent_28%),linear-gradient(90deg,rgba(105,70,39,0.05)_1px,transparent_1px),linear-gradient(rgba(105,70,39,0.04)_1px,transparent_1px)] bg-[size:auto,auto,28px_28px,28px_28px]" />
      <article className="relative mx-auto min-h-[calc(100vh-40px)] max-w-[1520px] overflow-hidden rounded-[22px] border border-[#d8c4a3] bg-[#fff8e9]/88 px-5 py-6 shadow-[0_28px_120px_rgba(80,50,18,0.16)] backdrop-blur sm:px-8 lg:px-10">
        <div className="pointer-events-none absolute -right-12 -top-16 size-56 rounded-full border border-[#b94c36]/25 text-[#b94c36]/10">
          <div className="flex h-full items-center justify-center font-serif text-8xl font-semibold">论</div>
        </div>

        <header className="relative mb-6 flex items-end justify-between gap-5 border-b border-[#dfcdae] pb-5">
          <div>
            <p className="mb-2 font-serif text-sm tracking-[0.46em] text-[#9e6c34]">TOKEN TREATISE</p>
            <h1 className="font-serif text-5xl font-semibold tracking-[0.18em] text-[#2c2015] sm:text-6xl">
              Token 论
            </h1>
          </div>
          <div className="flex size-16 shrink-0 items-center justify-center rounded-[4px] border border-[#b94c36] text-center font-serif text-sm font-semibold leading-tight text-[#b94c36]">
            智能
            <br />
            之世
          </div>
        </header>

        <div className="relative grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {tokenLunParagraphs.map((paragraph, index) => (
            <p
              key={paragraph}
              className="token-lun-card rounded-[12px] border border-[#e0ceb0] bg-[#fffaf0]/84 p-5 font-serif text-[17px] leading-[2.05] text-[#33271c] shadow-[0_10px_38px_rgba(80,50,18,0.07)] sm:text-[18px]"
            >
              <span className="mr-3 align-baseline text-sm tabular-nums text-[#b36c38]">{String(index + 1).padStart(2, "0")}</span>
              {paragraph}
            </p>
          ))}
        </div>
      </article>
      <a
        href="https://github.com/whyiug/tokenizer-hub"
        target="_blank"
        rel="noreferrer"
        aria-label="Open Tokenizer Hub on GitHub"
        className="fixed bottom-4 right-4 z-30 flex size-8 items-center justify-center rounded-[8px] border border-[#d9c3a1] bg-[#fff8e9]/92 text-[#745f43] shadow-[0_8px_28px_rgba(80,50,18,0.16)] backdrop-blur transition hover:border-[#b94c36] hover:bg-[#fffaf0] hover:text-[#2c2015]"
      >
        <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
          <path
            fill="currentColor"
            d="M8 0C3.58 0 0 3.67 0 8.2c0 3.62 2.29 6.69 5.47 7.77.4.08.55-.18.55-.4 0-.2-.01-.86-.01-1.56-2.01.38-2.53-.5-2.69-.96-.09-.24-.48-.96-.82-1.15-.28-.16-.68-.55-.01-.56.63-.01 1.08.59 1.23.84.72 1.24 1.87.89 2.33.68.07-.53.28-.89.51-1.09-1.78-.21-3.64-.91-3.64-4.04 0-.89.31-1.62.82-2.19-.08-.21-.36-1.04.08-2.16 0 0 .67-.22 2.2.84A7.4 7.4 0 0 1 8 3.94c.68 0 1.36.09 2 .28 1.52-1.06 2.19-.84 2.19-.84.44 1.12.16 1.95.08 2.16.51.57.82 1.3.82 2.19 0 3.14-1.87 3.83-3.65 4.04.29.26.54.75.54 1.52 0 1.09-.01 1.97-.01 2.24 0 .22.15.48.55.4A8.1 8.1 0 0 0 16 8.2C16 3.67 12.42 0 8 0Z"
          />
        </svg>
      </a>
    </main>
  );
}
