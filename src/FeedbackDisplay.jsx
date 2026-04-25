import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Header from './Header';

export default function FeedbackDisplay() {
  const navigate = useNavigate();
  const location = useLocation();
  const feedbackData = location.state?.feedback || null;
  const timeElapsed = location.state?.timeElapsed || null;
  const scenarioInfo = location.state?.scenarioInfo || null;
  const rubricBreakdown = location.state?.rubricBreakdown || null;
  const rubricTotalScore = location.state?.rubricTotalScore;
  const rubricMaxScore = location.state?.rubricMaxScore;
  const rubricPass = location.state?.rubricPass;
  const checkboxItems = location.state?.checkboxItems || null;

  // Group checkbox items by category (Pre-Arrival & Scene Size-Up, Primary Survey & Resuscitation, Disposition)
  const checkboxByCategory = (() => {
    if (!checkboxItems?.details) return null;
    const groups = {};
    Object.entries(checkboxItems.details).forEach(([id, item]) => {
      const category = item.category || 'Other';
      if (!groups[category]) groups[category] = [];
      groups[category].push({ id, ...item });
    });
    // Preserve canonical EMED111 order
    const order = ['Pre-Arrival & Scene Size-Up', 'Primary Survey & Resuscitation', 'Disposition'];
    return order
      .filter((cat) => groups[cat])
      .map((cat) => ({ category: cat, items: groups[cat] }))
      .concat(
        Object.keys(groups)
          .filter((cat) => !order.includes(cat))
          .map((cat) => ({ category: cat, items: groups[cat] }))
      );
  })();

  // If no feedback data, redirect back
  if (!feedbackData) {
    navigate('/');
    return null;
  }

  // Parse feedback text to extract structured data
  const parseFeedback = (text) => {
    // Default structure
    const parsed = {
      overallScore: null,
      maxScore: 38,
      passed: null,
      sections: [],
      strengths: [],
      improvements: [],
      summary: text
    };

    try {
      // Extract overall score pattern: "Score: 32/38" or "Final Score: 32/38"
      const scoreMatch = text.match(/(?:final\s+)?score:\s*(\d+)\s*\/\s*(\d+)/i);
      if (scoreMatch) {
        parsed.overallScore = parseInt(scoreMatch[1]);
        parsed.maxScore = parseInt(scoreMatch[2]);
        parsed.passed = parsed.overallScore >= 30; // Passing threshold
      }

      // Extract pass/fail status
      const passMatch = text.match(/\b(pass|fail|passed|failed)\b/i);
      if (passMatch && parsed.passed === null) {
        parsed.passed = passMatch[1].toLowerCase().startsWith('pass');
      }

      // Extract sections (look for patterns like "HPI: 2/3" or "Vital Signs: 3")
      const sectionPattern = /([A-Z][A-Za-z\s]+?):\s*(\d+)(?:\/(\d+))?/g;
      let match;
      while ((match = sectionPattern.exec(text)) !== null) {
        parsed.sections.push({
          name: match[1].trim(),
          score: parseInt(match[2]),
          maxScore: match[3] ? parseInt(match[3]) : 3
        });
      }

      // Extract strengths (look for "Strengths:" section)
      const strengthsMatch = text.match(/strengths?:?\s*\n?([\s\S]*?)(?=\n\n|improvements?:?|areas?|$)/i);
      if (strengthsMatch) {
        const strengthsText = strengthsMatch[1];
        const bullets = strengthsText.match(/[-•*]\s*([^\n]+)/g);
        if (bullets) {
          parsed.strengths = bullets.map(b => b.replace(/[-•*]\s*/, '').trim());
        }
      }

      // Extract improvements
      const improvementsMatch = text.match(/(?:improvements?|areas?\s+for\s+improvement):?\s*\n?([\s\S]*?)(?=\n\n|$)/i);
      if (improvementsMatch) {
        const improvementsText = improvementsMatch[1];
        const bullets = improvementsText.match(/[-•*]\s*([^\n]+)/g);
        if (bullets) {
          parsed.improvements = bullets.map(b => b.replace(/[-•*]\s*/, '').trim());
        }
      }
    } catch (error) {
      console.error('Error parsing feedback:', error);
    }

    return parsed;
  };

  const feedback = parseFeedback(feedbackData);
  const passed = rubricBreakdown != null && typeof rubricPass === 'boolean'
    ? rubricPass
    : feedback.passed;
  const overallScore = rubricBreakdown != null && typeof rubricTotalScore === 'number'
    ? rubricTotalScore
    : feedback.overallScore;
  const maxScore = rubricBreakdown != null && typeof rubricMaxScore === 'number'
    ? rubricMaxScore
    : feedback.maxScore;
  const percentage = overallScore != null && maxScore != null && maxScore > 0
    ? Math.round((overallScore / maxScore) * 100)
    : null;

  const formatTime = (seconds) => {
    if (!seconds) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#3b82f6',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        background: 'white'
      }}>
        <Header />
      </div>

      <div style={{
        marginTop: '76px',
        flexGrow: 1,
        padding: '2rem',
        paddingBottom: '2rem',
        overflowY: 'auto'
      }}>
        <div style={{
          maxWidth: '900px',
          margin: '0 auto',
          width: '100%'
        }}>
          {/* Header Section */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '20px',
            padding: '2.5rem',
            marginBottom: '1.5rem',
            boxShadow: '0 10px 24px rgba(0, 0, 0, 0.12)',
            textAlign: 'center'
          }}>
            <h1 style={{
              fontSize: '2.5rem',
              fontWeight: 'bold',
              color: passed ? '#10b981' : '#ef4444',
              marginBottom: '0.5rem',
              marginTop: 0
            }}>
              Scenario Complete
            </h1>
            
            {scenarioInfo && (
              <p style={{
                fontSize: '1.1rem',
                color: '#666',
                marginBottom: '1.5rem'
              }}>
                {scenarioInfo.mainScenario} - {scenarioInfo.subScenario}
              </p>
            )}

            {/* Score Display */}
            {(overallScore !== null || rubricBreakdown?.length) && (
              <div style={{
                display: 'inline-block',
                backgroundColor: passed ? '#d1fae5' : '#fee2e2',
                padding: '1.5rem 3rem',
                borderRadius: '15px',
                marginTop: '1rem'
              }}>
                <div style={{
                  fontSize: '3.5rem',
                  fontWeight: 'bold',
                  color: passed ? '#10b981' : '#ef4444',
                  marginBottom: '0.5rem'
                }}>
                  {passed ? 'PASS' : 'FAIL'}
                </div>
                {overallScore != null && maxScore != null && (
                  <div style={{ fontSize: '1.25rem', color: '#374151' }}>
                    Score: {overallScore}/{maxScore}
                    {percentage != null && ` (${percentage}%)`}
                  </div>
                )}
              </div>
            )}

            {/* Time Elapsed */}
            {timeElapsed && (
              <div style={{
                marginTop: '1.5rem',
                fontSize: '1rem',
                color: '#666'
              }}>
                Time: {formatTime(timeElapsed)}
              </div>
            )}
          </div>

          {/* Critical Checkbox Items - all required to pass */}
          {checkboxByCategory && checkboxByCategory.length > 0 && (
            <div style={{
              backgroundColor: 'white',
              borderRadius: '20px',
              padding: '2rem',
              marginBottom: '1.5rem',
              boxShadow: '0 10px 24px rgba(0, 0, 0, 0.12)'
            }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: '#000',
                marginBottom: '0.5rem',
                marginTop: 0
              }}>
                Critical Checkbox Items
              </h2>
              <p style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '1.5rem' }}>
                All items must be completed to pass — {checkboxItems.completed}/{checkboxItems.total} completed
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {checkboxByCategory.map(({ category, items }) => {
                  const completedInGroup = items.filter((i) => i.completed).length;
                  const allDone = completedInGroup === items.length;
                  return (
                    <div key={category} style={{
                      padding: '1rem',
                      backgroundColor: '#f9fafb',
                      borderRadius: '10px',
                      borderLeft: `4px solid ${allDone ? '#10b981' : '#ef4444'}`
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.75rem'
                      }}>
                        <span style={{
                          fontWeight: '600',
                          color: '#000',
                          fontSize: '1rem'
                        }}>
                          {category}
                        </span>
                        <span style={{
                          fontWeight: 'bold',
                          color: allDone ? '#10b981' : '#ef4444',
                          fontSize: '1rem'
                        }}>
                          {completedInGroup}/{items.length}
                        </span>
                      </div>
                      <ul style={{
                        listStyle: 'none',
                        padding: 0,
                        margin: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem'
                      }}>
                        {items.map((item) => (
                          <li key={item.id} style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.6rem',
                            padding: '0.5rem 0.6rem',
                            backgroundColor: item.completed ? '#d1fae5' : '#fee2e2',
                            borderRadius: '6px',
                            fontSize: '0.9rem',
                            color: item.completed ? '#065f46' : '#991b1b'
                          }}>
                            <span style={{
                              fontWeight: 'bold',
                              minWidth: '1.2rem',
                              lineHeight: 1.4
                            }}>
                              {item.completed ? '✓' : '✗'}
                            </span>
                            <span style={{ lineHeight: 1.4 }}>{item.description}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Rubric Breakdown - from EMED111 rubric when available */}
          {rubricBreakdown && rubricBreakdown.length > 0 ? (
            <div style={{
              backgroundColor: 'white',
              borderRadius: '20px',
              padding: '2rem',
              marginBottom: '1.5rem',
              boxShadow: '0 10px 24px rgba(0, 0, 0, 0.12)'
            }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: '#000',
                marginBottom: '0.5rem',
                marginTop: 0
              }}>
                Rubric Breakdown
              </h2>
              <p style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '1.5rem' }}>
                EMED111 rubric — minimum 2 points per section to pass
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {rubricBreakdown.map((section) => {
                  const sectionPercentage = section.maxScore > 0
                    ? Math.round((section.score / section.maxScore) * 100)
                    : 0;
                  const isPassing = section.score >= 2;
                  const criteriaLevels = section.criteriaLevels || {};
                  return (
                    <div key={section.id} style={{
                      padding: '1rem',
                      backgroundColor: '#f9fafb',
                      borderRadius: '10px',
                      borderLeft: `4px solid ${isPassing ? '#10b981' : '#f59e0b'}`
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.5rem'
                      }}>
                        <span style={{
                          fontWeight: '600',
                          color: '#000',
                          fontSize: '1rem'
                        }}>
                          {section.name}
                        </span>
                        <span style={{
                          fontWeight: 'bold',
                          color: isPassing ? '#10b981' : '#f59e0b',
                          fontSize: '1.1rem'
                        }}>
                          {section.score}/{section.maxScore}
                        </span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '8px',
                        backgroundColor: '#e5e7eb',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        marginBottom: '0.75rem'
                      }}>
                        <div style={{
                          width: `${sectionPercentage}%`,
                          height: '100%',
                          backgroundColor: isPassing ? '#10b981' : '#f59e0b',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#4b5563' }}>
                        <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>Criteria:</div>
                        {[0, 1, 2, 3].map((level) => {
                          const text = criteriaLevels[level];
                          if (!text) return null;
                          const isAchieved = section.score === level;
                          return (
                            <div
                              key={level}
                              style={{
                                padding: '0.35rem 0.5rem',
                                marginBottom: '0.2rem',
                                borderRadius: '6px',
                                backgroundColor: isAchieved ? (level >= 2 ? '#d1fae5' : '#fef3c7') : '#f3f4f6',
                                borderLeft: isAchieved ? `3px solid ${level >= 2 ? '#10b981' : '#f59e0b'}` : '3px solid transparent'
                              }}
                            >
                              <span style={{ fontWeight: isAchieved ? '600' : '400' }}>
                                {level} pt{level !== 1 ? 's' : ''}: {text}
                                {isAchieved && ' ✓'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      {/* Explanation shown only when score is not perfect */}
                      {section.score < section.maxScore && section.feedback && section.feedback.length > 0 && (
                        <div style={{
                          marginTop: '0.75rem',
                          padding: '0.6rem 0.75rem',
                          backgroundColor: '#fffbeb',
                          borderRadius: '6px',
                          borderLeft: '3px solid #f59e0b',
                          fontSize: '0.85rem',
                          color: '#78350f'
                        }}>
                          <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>Why you didn&apos;t receive full points:</div>
                          {section.feedback.map((line, i) => (
                            <div key={i} style={{ marginBottom: i < section.feedback.length - 1 ? '0.2rem' : 0 }}>
                              • {line}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : feedback.sections.length > 0 &&
            !(feedback.sections.length === 1 &&
              feedback.sections[0].name === 'Final Score' &&
              typeof feedbackData === 'string' &&
              (feedbackData.includes('Unable to parse feedback') || feedbackData.includes('Error parsing feedback response'))) && (
            <div style={{
              backgroundColor: 'white',
              borderRadius: '20px',
              padding: '2rem',
              marginBottom: '1.5rem',
              boxShadow: '0 10px 24px rgba(0, 0, 0, 0.12)'
            }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: '#000',
                marginBottom: '1.5rem',
                marginTop: 0
              }}>
                Rubric Breakdown
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {feedback.sections.map((section, idx) => {
                  const sectionPercentage = Math.round((section.score / section.maxScore) * 100);
                  const isPassing = section.score >= 2;
                  return (
                    <div key={idx} style={{
                      padding: '1rem',
                      backgroundColor: '#f9fafb',
                      borderRadius: '10px',
                      borderLeft: `4px solid ${isPassing ? '#10b981' : '#f59e0b'}`
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.5rem'
                      }}>
                        <span style={{
                          fontWeight: '600',
                          color: '#000',
                          fontSize: '1rem'
                        }}>
                          {section.name}
                        </span>
                        <span style={{
                          fontWeight: 'bold',
                          color: isPassing ? '#10b981' : '#f59e0b',
                          fontSize: '1.1rem'
                        }}>
                          {section.score}/{section.maxScore}
                        </span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '8px',
                        backgroundColor: '#e5e7eb',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${sectionPercentage}%`,
                          height: '100%',
                          backgroundColor: isPassing ? '#10b981' : '#f59e0b',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Strengths */}
          {feedback.strengths.length > 0 && (
            <div style={{
              backgroundColor: 'white',
              borderRadius: '20px',
              padding: '2rem',
              marginBottom: '1.5rem',
              boxShadow: '0 10px 24px rgba(0, 0, 0, 0.12)'
            }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: '#10b981',
                marginBottom: '1rem',
                marginTop: 0
              }}>
                What You Did Well
              </h2>
              <ul style={{
                listStyle: 'none',
                padding: 0,
                margin: 0
              }}>
                {feedback.strengths.map((strength, idx) => (
                  <li key={idx} style={{
                    padding: '0.75rem',
                    marginBottom: '0.5rem',
                    backgroundColor: '#d1fae5',
                    borderRadius: '8px',
                    color: '#065f46',
                    fontSize: '0.95rem'
                  }}>
                    • {strength}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Areas for Improvement */}
          {feedback.improvements.length > 0 && (
            <div style={{
              backgroundColor: 'white',
              borderRadius: '20px',
              padding: '2rem',
              marginBottom: '1.5rem',
              boxShadow: '0 10px 24px rgba(0, 0, 0, 0.12)'
            }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: '#f59e0b',
                marginBottom: '1rem',
                marginTop: 0
              }}>
                Areas for Improvement
              </h2>
              <ul style={{
                listStyle: 'none',
                padding: 0,
                margin: 0
              }}>
                {feedback.improvements.map((improvement, idx) => (
                  <li key={idx} style={{
                    padding: '0.75rem',
                    marginBottom: '0.5rem',
                    backgroundColor: '#fef3c7',
                    borderRadius: '8px',
                    color: '#92400e',
                    fontSize: '0.95rem'
                  }}>
                    • {improvement}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'center',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={() => navigate('/')}
              style={{
                backgroundColor: '#E60000',
                color: 'white',
                padding: '1rem 2.5rem',
                borderRadius: '12px',
                border: 'none',
                fontSize: '1.1rem',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(230, 0, 0, 0.3)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#cc0000';
                e.target.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#E60000';
                e.target.style.transform = 'translateY(0)';
              }}
            >
              Try Another Scenario
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
