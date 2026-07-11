/**
 * @typedef {Object} StabilityResult
 * @property {boolean} ok
 * @property {number} cpM
 * @property {number} cgFullM
 * @property {number} cgEmptyM
 * @property {number} staticMarginFull
 * @property {number} staticMarginEmpty
 * @property {number|null} recommendedBallastKg
 * @property {Array} issues
 */

const issue = (field, code, severity, message) => ({ field, code, severity, message });

/** Barrowman-style subsonic slender-body estimate. Pure, SI-only. */
export function calculateStability(input) {
  const { rocketType, geometry: g, mass: m, waterVolumeM3, targetStaticMargin = null, workshopBallastKg = 0 } = input;
  const issues = [];
  const referenceDiameter = rocketType === 'hydrogen' ? Math.max(g.upperDiameterM, g.lowerDiameterM) : g.bodyDiameterM;
  const bodyLength = rocketType === 'hydrogen' ? g.upperLengthM + g.transitionLengthM + g.lowerLengthM : g.bodyLengthM;
  const tipChord = g.finRootChordM - g.finSpanM * Math.tan(g.finSweepRad);
  if (tipChord < 0) issues.push(issue('finTipChord', 'NEGATIVE_FIN_TIP', 'error', 'フィン先端長が負です。根元長・高さ・後退角を調整してください。'));
  if (!(referenceDiameter > 0) || !(bodyLength > 0)) issues.push(issue('geometry', 'INVALID_GEOMETRY', 'error', '機体寸法は0より大きくしてください。'));
  if (issues.some(x => x.severity === 'error')) return { ok: false, issues, recommendedBallastKg: null };

  const refArea = Math.PI * (referenceDiameter / 2) ** 2;
  const finAreaOne = (g.finRootChordM + tipChord) * g.finSpanM / 2;
  const finNormalSlope = 2 * finAreaOne * g.finCount / refArea;
  const sweepDistance = g.finSpanM * Math.tan(g.finSweepRad);
  const chordSum = g.finRootChordM + tipChord;
  const localFinCp = sweepDistance * (g.finRootChordM + 2 * tipChord) / (3 * chordSum)
    + (chordSum - g.finRootChordM * tipChord / chordSum) / 6;
  const finLeadingEdge = g.noseLengthM + bodyLength - g.finRearOffsetM - g.finRootChordM;
  const finCp = finLeadingEdge + localFinCp;
  const noseSlope = 2;
  const noseCp = 2 * g.noseLengthM / 3;
  let transitionSlope = 0;
  let transitionCp = 0;
  if (rocketType === 'hydrogen' && g.lowerDiameterM > g.upperDiameterM && g.transitionLengthM > 0) {
    transitionSlope = 2 * ((g.lowerDiameterM / referenceDiameter) ** 2 - (g.upperDiameterM / referenceDiameter) ** 2);
    const ratio = g.upperDiameterM / g.lowerDiameterM;
    transitionCp = g.noseLengthM + g.upperLengthM + g.transitionLengthM / 3 * (1 + 1 / (1 + ratio));
  }
  const totalSlope = noseSlope + transitionSlope + finNormalSlope;
  const cpM = (noseSlope * noseCp + transitionSlope * transitionCp + finNormalSlope * finCp) / totalSlope;

  const noseCg = 2 * g.noseLengthM / 3;
  const bodyCg = g.noseLengthM + bodyLength / 2;
  const finCg = finLeadingEdge + g.finRootChordM / 2;
  const ballastCg = g.noseLengthM * 0.05;
  const finMass = m.finMassEachKg * g.finCount;
  const waterMass = rocketType === 'pet' ? waterVolumeM3 * 1000 : 0;
  const bottleArea = Math.PI * (g.bodyDiameterM / 2) ** 2;
  const waterHeight = Math.min(bodyLength, waterVolumeM3 / bottleArea);
  const waterCg = g.noseLengthM + bodyLength - waterHeight / 2;
  const baseMass = m.noseMassKg + m.bodyMassKg + finMass;
  const baseMoment = m.noseMassKg * noseCg + m.bodyMassKg * bodyCg + finMass * finCg;
  const fullBaseMass = baseMass + waterMass;
  const fullBaseMoment = baseMoment + waterMass * waterCg;

  let ballast = workshopBallastKg;
  if (targetStaticMargin !== null) {
    const requestedCg = cpM - targetStaticMargin * referenceDiameter;
    const denominator = requestedCg - ballastCg;
    if (denominator <= 0) {
      issues.push(issue('targetStaticMargin', 'BALLAST_UNREACHABLE', 'error', '目標SMはノーズバラストでは実現できません。'));
      ballast = null;
    } else {
      ballast = Math.max(0, (fullBaseMoment - requestedCg * fullBaseMass) / denominator);
      if (ballast > 0.5) issues.push(issue('targetStaticMargin', 'EXCESSIVE_BALLAST', 'warning', '推奨バラストが500 gを超えています。形状の見直しを推奨します。'));
    }
  }
  if (ballast === null) return { ok: false, cpM, issues, recommendedBallastKg: null };
  const cgFullM = (fullBaseMoment + ballast * ballastCg) / (fullBaseMass + ballast);
  const cgEmptyM = (baseMoment + ballast * ballastCg) / (baseMass + ballast);
  const staticMarginFull = (cpM - cgFullM) / referenceDiameter;
  const staticMarginEmpty = (cpM - cgEmptyM) / referenceDiameter;
  const safeThreshold = rocketType === 'hydrogen' ? 1 : 0.7;
  if (Math.min(staticMarginFull, staticMarginEmpty) < safeThreshold - 1e-9) issues.push(issue('staticMargin', 'UNSTABLE', 'warning', `静安定余裕が推奨値 ${safeThreshold} 未満です。`));
  return {
    ok: true, cpM, cgFullM, cgEmptyM, staticMarginFull, staticMarginEmpty,
    recommendedBallastKg: ballast, finAreaOneM2: finAreaOne,
    totalDryMassKg: baseMass + ballast,
    issues,
    model: 'Barrowman-style, incompressible, small-angle, subsonic estimate',
    assumptions: ['軸対称の細長い機体', '小迎角・亜音速', '胴体揚力とフィン干渉を簡略化']
  };
}
