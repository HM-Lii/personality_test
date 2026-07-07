/**
 * 生成 docs/figures-rationale.json（62 人向量理论依据）
 * 运行：node scripts/build-figures-rationale.mjs
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { FIGURES } from "../src/data/figures.mjs";

/** @type {Record<string, { tags: string[]; rationale: string }>} */
const RATIONALE_BY_ID = {
  confucius: {
    tags: ["仁和凝聚者", "系统规划者"],
    rationale:
      "O/C/A 偏高体现以礼乐秩序温养人心；E 中等、R 中高，符合师者重教化而非冲杀的形象。",
  },
  mozi: {
    tags: ["仁和凝聚者", "铁律变法者"],
    rationale:
      "高 O/C 对应兼爱非攻的可操作方案；A 高、E 中低体现以实践凝聚同道而非社交型领袖。",
  },
  zhuangzi: {
    tags: ["逍遥避世者", "才情表达者"],
    rationale:
      "O 很高、C/E 很低、R 很高，典型超然避世：拒受庙堂位置，以想象与自由安顿心神。",
  },
  "han-fei": {
    tags: ["铁律变法者", "系统规划者"],
    rationale:
      "高 C/O 支撑制度洞察；A 很低体现以利害而非道德说服；E 中低符合结巴于言、锋利于笔的旁观者。",
  },
  "sun-wu": {
    tags: ["系统规划者", "刚直原则者"],
    rationale:
      "C 很高、R 很高体现战前算尽；E 低、A 中低对应以军法克制、不讨好私情的谋者。",
  },
  "shang-yang": {
    tags: ["铁律变法者", "破局雄主"],
    rationale:
      "C 极高、A 极低是徙木立信的铁律改革者；E 中高体现推法所需的强势执行面。",
  },
  "qu-yuan": {
    tags: ["理想求索者", "仁和凝聚者"],
    rationale:
      "O/A 高而 R 很低，对应理想洁癖与《天问》式敏感；C 偏高体现楚辞结构的自持。",
  },
  "qin-shihuang": {
    tags: ["铁律变法者", "破局雄主"],
    rationale:
      "C/E 极高、A 极低体现一统建制与不容第二度量；O 中高对应制度创新的开放度有限但存在。",
  },
  "liu-bang": {
    tags: ["破局雄主", "仁和凝聚者"],
    rationale:
      "E 很高、A 偏高体现市井人脉与用人；C 中低对应灵活破局而非精密规划；R 高是乱世生存力。",
  },
  "xiang-yu": {
    tags: ["勇锐锋芒者", "破局雄主"],
    rationale:
      "E 极高、A/R 很低是正面硬刚的勇锐原型；O/C 中等避免与中部人物重叠，保留极端锋锐区。",
  },
  "zhang-liang": {
    tags: ["系统规划者", "逍遥避世者"],
    rationale:
      "O 高、C 中高、E 很低体现谋定后隐退；R 很高对应辟谷学道的长期自持。",
  },
  "han-xin": {
    tags: ["系统规划者", "勇锐锋芒者"],
    rationale:
      "O 很高体现非常规用兵；C 中高支撑阵法纪律；A 低、R 中低对应功高震主与政治钝感。",
  },
  "xiao-he": {
    tags: ["守成定海者", "系统规划者"],
    rationale:
      "C 极高、R 很高是后勤托底型守成；O 低、E 中低体现不抢风头、稳转大局的定位。",
  },
  "sima-qian": {
    tags: ["史官记录者", "理想求索者"],
    rationale:
      "O/C 高支撑宏大叙事与求证；E 低符合隐于朝堂的史官；R 中低对应受刑后的创伤敏感。",
  },
  "ban-zhao": {
    tags: ["治学求证者", "仁和凝聚者"],
    rationale:
      "C 很高、A 很高体现整理学问与人情搭桥；E 低符合闺阁学者而非外向驱动。",
  },
  "zhang-qian": {
    tags: ["远行探索者", "治学求证者"],
    rationale:
      "O/E 高、R 中高体现凿空西域的胆与续航；C/A 中高对应使节外交所需的持重与信义。",
  },
  "huo-qubing": {
    tags: ["勇锐锋芒者", "破局雄主"],
    rationale:
      "E 极高、R 高是闪电奇袭的先锋；C 中低、A 中低体现年轻将门的锐进与少顾虑。",
  },
  "cao-cao": {
    tags: ["破局雄主", "系统规划者"],
    rationale:
      "O/E 很高、A 很低是变局雄主；C 高支撑用人与制度；R 中高对应乱世中的情绪掌控。",
  },
  "lu-bu": {
    tags: ["勇锐锋芒者", "破局雄主"],
    rationale:
      "E 极高、A 极低、C/R 很低是反复择主的孤狼武勇；O 中低体现少谋、凭锋锐求生。",
  },
  "liu-bei": {
    tags: ["仁和凝聚者", "守成定海者"],
    rationale:
      "A 极高、E 偏高体现信义聚人；C 中高对应托孤与建制；O 中等是仁德型而非奇谋型领袖。",
  },
  "sun-quan": {
    tags: ["守成定海者", "系统规划者"],
    rationale:
      "C/R 很高、E/A 中等体现多方拉扯中的守成定力；O 中等对应务实联衡而非开拓型。",
  },
  "zhuge-liang": {
    tags: ["系统规划者", "治世循吏"],
    rationale:
      "C 极高、O 高是长期布局；E 低、A 中高对应幕后筹画与以德服人；R 中高支撑北伐韧性。",
  },
  "sima-yi": {
    tags: ["系统规划者", "守成定海者"],
    rationale:
      "C 极高、R 极高、E 很低是深忍蛰伏；A 低对应权谋优先于共情。",
  },
  "zhou-yu": {
    tags: ["勇锐锋芒者", "才情表达者"],
    rationale:
      "E 高、O 高体现风雅与锋芒并存；C 高支撑赤壁统筹；A 中低对应统帅所需的决断。",
  },
  "lu-su": {
    tags: ["仁和凝聚者", "守成定海者"],
    rationale:
      "A 极高体现联刘抗曹的协调；C 中高、R 中高对应为联盟让利的远见与稳态。",
  },
  "guan-yu": {
    tags: ["刚直原则者", "勇锐锋芒者"],
    rationale:
      "C 很高、R 很高、O/A 中低是义字当头的原则型武将；E 中高对应阵前存在感。",
  },
  "zhao-yun": {
    tags: ["守成定海者", "刚直原则者"],
    rationale:
      "C/R 极高、E 低是可靠守护者；A 偏高体现护主与克制的仁将气质。",
  },
  "ma-chao": {
    tags: ["勇锐锋芒者", "破局雄主"],
    rationale:
      "E 极高、A 低、R 低是骁勇少谋的锦马；C 中等略高以与吕布区分，体现转战求归的些许持重。",
  },
  "cao-zhi": {
    tags: ["才情表达者", "理想求索者"],
    rationale:
      "O 极高、C 低、R 低是才思敏感公子；A 偏高体现《七步诗》式共情；E 中等对应宫廷社交。",
  },
  "tao-yuanming": {
    tags: ["逍遥避世者", "才情表达者"],
    rationale:
      "E 极低、C 低、R 很高是归田自洽；O 高、A 偏高体现对自然与本真的开放。",
  },
  "ji-kang": {
    tags: ["逍遥避世者", "才情表达者"],
    rationale:
      "O 极高、C/E 极低是拒仕孤松；A 中低、R 中等对应宁折不弯与广陵绝响的审美极端。",
  },
  "ruan-ji": {
    tags: ["逍遥避世者", "才情表达者"],
    rationale:
      "O 很高、C/E 低、R 高是险世保身；较嵇康 R 更高、E 略高，体现醉眼避祸而非硬抗。",
  },
  "liu-ling": {
    tags: ["逍遥避世者", "才情表达者"],
    rationale:
      "O 高、C/E 极低、A 低是放达酒徒；R 中高对应以醉消解礼法的内在自洽。",
  },
  "tang-taizong": {
    tags: ["破局雄主", "守成定海者"],
    rationale:
      "E/O/C/R 均高体现纳谏进取的明君；A 中等对应能听逆耳但仍需帝王决断。",
  },
  "wu-zetian": {
    tags: ["破局雄主", "铁律变法者"],
    rationale:
      "C/E/R 极高、A 很低是铁腕掌局；O 高对应识人与制度创新。",
  },
  "shangguan-waner": {
    tags: ["系统规划者", "才情表达者"],
    rationale:
      "O/C 高、E 偏高体现权力夹缝中的文思与应变；A 中等对应斡旋而非纯刚。",
  },
  "wei-zheng": {
    tags: ["刚直原则者", "治世循吏"],
    rationale:
      "C 很高、A 很低、R 高是逆耳诤臣；E 中等对应朝堂直言的存在感。",
  },
  "di-renjie": {
    tags: ["治世循吏", "系统规划者"],
    rationale:
      "C/A/R 高体现公正与体察；O 中高对应断案如神的洞察；E 中等是判官型而非社交型。",
  },
  "guo-ziyi": {
    tags: ["守成定海者", "仁和凝聚者"],
    rationale:
      "R 极高、C 很高、A 很高是功高不疑的定海；E 中等对应军中威望与朝堂宽厚。",
  },
  "li-bai": {
    tags: ["才情表达者", "远行探索者"],
    rationale:
      "O/E 极高、C 很低是纵歌谪仙；R 中低对应情绪起伏与拒受约束。",
  },
  "du-fu": {
    tags: ["仁和凝聚者", "理想求索者"],
    rationale:
      "A 极高、C 高体现关怀与记录；O 高对应诗史视野；R 低、E 低是沉潜忧世而非外向驱动。",
  },
  "wang-wei": {
    tags: ["逍遥避世者", "才情表达者"],
    rationale:
      "O 高、E 极低、R 很高是辋川静观；A 偏高体现诗画中的温厚；C 中等对应半官半隐的持重。",
  },
  xuanzang: {
    tags: ["远行探索者", "治学求证者"],
    rationale:
      "O/C/R 极高体现十七年求法的信念与求证；E 很低对应独行僧而非社交型。",
  },
  "fan-zhongyan": {
    tags: ["治世循吏", "仁和凝聚者"],
    rationale:
      "C/A 很高、R 中高是先忧后乐的循吏；O/E 中等对应公共担当而非奇谋。",
  },
  "wang-anshi": {
    tags: ["铁律变法者", "系统规划者"],
    rationale:
      "O/C 极高、A 很低是一整套新法的系统改革；E 中低对应朝堂坚持而非外向魅力。",
  },
  "sima-guang": {
    tags: ["史官记录者", "治世循吏"],
    rationale:
      "C 极高、O/E 很低是审慎守序；R 高对应十九年编史的耐力；反对猛变符合低 O。",
  },
  "su-shi": {
    tags: ["才情表达者", "逍遥避世者"],
    rationale:
      "O 极高、E 很高、A 很高是旷达东坡；C 中等、R 中高对应贬谪中的烟火 resilience。",
  },
  "yue-fei": {
    tags: ["刚直原则者", "守成定海者"],
    rationale:
      "C 极高、R 很高、A 偏高是严纪忠将；O 低、E 中高对应信念驱动而非奇谋多变。",
  },
  "xin-qiji": {
    tags: ["勇锐锋芒者", "才情表达者"],
    rationale:
      "E 极高、O 高是词将双锋；C 中高支撑用兵；R 中低对应壮志难酬的积郁。",
  },
  "li-qingzhao": {
    tags: ["理想求索者", "才情表达者"],
    rationale:
      "O 很高、R 很低是纤毫敏感；C 中等、A 偏高对应词作中的共情与自持。",
  },
  "shen-kuo": {
    tags: ["治学求证者", "系统规划者"],
    rationale:
      "O/C 极高体现博物验证；E 中等、R 高对应《梦溪笔谈》式长期好奇与稳态。",
  },
  "zhang-juzheng": {
    tags: ["铁律变法者", "系统规划者"],
    rationale:
      "C 极高、A 很低是雷霆首辅；O 中高、R 高对应考成法与一条鞭的整顿意志。",
  },
  "wang-yangming": {
    tags: ["系统规划者", "治学求证者"],
    rationale:
      "O/C/R 高体现知行合一与龙场悟道；E 中等对应平叛行动面；A 中等是教化为先。",
  },
  "tang-yin": {
    tags: ["才情表达者", "逍遥避世者"],
    rationale:
      "O 极高、C 低、R 很低是失意风流的解元；E 中等、A 中等对应卖画自放而非高协作。",
  },
  "hai-rui": {
    tags: ["刚直原则者", "治世循吏"],
    rationale:
      "C 极高、A 很低、R 很高是备棺上疏的清官；O/E 低对应不随潮流、少社交。",
  },
  "qi-jiguang": {
    tags: ["守成定海者", "铁律变法者"],
    rationale:
      "C 极高、R 很高体现练兵实战；E 偏高对应帅府组织；O 中高对应火器阵法创新。",
  },
  "zheng-he": {
    tags: ["破局雄主", "远行探索者"],
    rationale:
      "C/E/A/R 均高体现七下西洋的组织与连接；O 高对应开放通联而非拓土。",
  },
  "xu-xiake": {
    tags: ["远行探索者", "逍遥避世者"],
    rationale:
      "O 极高、C 低、E 中低是自主行走；R 高对应三十余年路上的身心续航。",
  },
  "li-shizhen": {
    tags: ["治学求证者", "远行探索者"],
    rationale:
      "O/C 极高、R 高是二十七年亲证本草；E 低对应沉潜观察而非外向表达。",
  },
  "zeng-guofan": {
    tags: ["铁律变法者", "守成定海者"],
    rationale:
      "C 极高、O/E 低是结硬寨打呆仗；R 中高对应日课自省与湘军持久；A 中等是驭下而非高共情。",
  },
  "lin-zexu": {
    tags: ["治世循吏", "刚直原则者"],
    rationale:
      "C 很高、R 高、E 偏高是虎门担当；A 中等对应国士务实而非纯理想。",
  },
  "qiu-jin": {
    tags: ["勇锐锋芒者", "理想求索者"],
    rationale:
      "E 很高、O 高是先行侠女；C 偏高、R 中低对应革命理想与就义锋芒。",
  },
};

const missing = FIGURES.filter((figure) => !RATIONALE_BY_ID[figure.id]);
if (missing.length > 0) {
  console.error("缺少 rationale 条目：", missing.map((f) => f.id).join(", "));
  process.exitCode = 1;
} else {
  const output = FIGURES.map((figure) => {
    const entry = RATIONALE_BY_ID[figure.id];
    return {
      id: figure.id,
      tags: entry.tags,
      vector: figure.vector,
      rationale: entry.rationale,
    };
  });

  const outPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "docs",
    "figures-rationale.json",
  );
  writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`✓ 已写入 ${output.length} 条 → ${outPath}`);
}
