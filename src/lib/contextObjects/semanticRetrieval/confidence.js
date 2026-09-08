const CONFIRMABLE_VALIDATION_ERRORS = new Set([
  'unit required for semantic unit',
  'coded value allowed'
]);

function isConfirmableValidationFailure(validation) {
  const errors = Array.isArray(validation?.errors) ? validation.errors : [];
  return errors.length > 0 && errors.every((error) => CONFIRMABLE_VALIDATION_ERRORS.has(error));
}

export function classifyResolverConfidence({
  topScore = 0,
  secondScore = 0,
  validation = { valid: false },
  hasPolicyTrigger = false,
  hasExplicitMeasurement = false,
  bestCandidate = null
} = {}) {
  const margin = Math.max(0, topScore - secondScore);
  const reasons = [];

  if (!validation?.valid) {
    reasons.push('candidate_validation_failed');
  }

  if (margin < 0.1) {
    reasons.push('small_margin');
  }

  if (topScore < 0.7) {
    reasons.push('low_score');
  }

  if (hasPolicyTrigger && (!bestCandidate || topScore < 0.85)) {
    return {
      decision: 'confirm_policy',
      score: topScore,
      margin,
      reasons: [...reasons, 'policy_term_requires_contract']
    };
  }

  if (!bestCandidate) {
    return {
      decision: 'unsupported',
      score: topScore,
      margin,
      reasons: [...reasons, 'no_candidate']
    };
  }

  if (validation?.valid && topScore >= 0.9 && margin >= 0.1) {
    return {
      decision: 'auto_execute',
      score: topScore,
      margin,
      reasons
    };
  }

  if (validation?.valid && topScore >= 0.7) {
    return {
      decision: hasExplicitMeasurement ? 'confirm_contract' : 'confirm_datapoint',
      score: topScore,
      margin,
      reasons
    };
  }

  if (!validation?.valid && topScore >= 0.7 && isConfirmableValidationFailure(validation)) {
    return {
      decision: hasExplicitMeasurement ? 'confirm_contract' : 'confirm_datapoint',
      score: topScore,
      margin,
      reasons: [...reasons, 'needs_confirmation']
    };
  }

  return {
    decision: 'unsupported',
    score: topScore,
    margin,
    reasons
  };
}
