import { useState, useEffect } from 'react';
import { Form, Dropdown, Accordion, Card, Container, Button } from 'react-bootstrap';
import './Dashboard.css';
import { childData } from './childData';
import { goalData } from './goalDetails';

const Dashboard = () => {
  const [searchInput, setSearchInput] = useState('');
  const [selectedChild, setSelectedChild] = useState(null);
  const [age, setAge] = useState('');
  const [childDetails, setChildDetails] = useState([]);
  const [goalDetails, setGoalDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch child details
        try {
          const childResponse = await fetch("http://16.145.70.192:8080/api/children", {
            cache: "no-store"
          });

          if (!childResponse.ok) throw new Error('Failed to fetch child details');
          const childDataApi = await childResponse.json();
          setChildDetails(childDataApi);
        } catch (err) {
          console.warn('Child API failed, using static data:', err.message);
        setChildDetails(childData);
        }

        // Fetch goal details
        try {
          const goalsResponse = await fetch('http://16.145.70.192:8080/api/goals', {
            cache: "no-store"
          });
          if (!goalsResponse.ok) throw new Error('Failed to fetch goal details');
          const goalsDataApi = await goalsResponse.json();
          setGoalDetails(goalsDataApi);
        } catch (err) {
          console.warn('Goals API failed, using static data:', err.message);
        setGoalDetails(goalData);
        }

        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
        console.error('Error fetching data:', err);
      }
    };

    fetchData();
  }, []);

  const calculateAge = (dateOfBirth) => {
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let calculatedAge = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      calculatedAge--;
    }

    return calculatedAge;
  };

  const sendAchievements = async () => {
    if (!selectedChild) return;

    const doctorId = (selectedChild.doctors && selectedChild.doctors[0] && selectedChild.doctors[0].id) || null;

    const achievementsPayload = (selectedChild.achievements || [])
      .map(a => ({
        goalId: a.goal && a.goal.id ? a.goal.id : (a.goal || {}).id,
        level: a.level,
        notes: a.notes || ''
      }))
      .filter(a => a.level !== 'INTERMEDIATE');

    const payload = {
      childId: selectedChild.id,
      doctorId,
      achievements: achievementsPayload
    };
  // api expects { childId, doctorId, achievements: [{ goalId, level, notes }] }  
    try {
      const res = await fetch('http://16.145.70.192:8080/api/achievements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to save achievements');
      }

      // Optionally refresh or give feedback
      alert('Achievements saved successfully');
    } catch (err) {
      console.error('Save achievements error:', err);
      alert('Error saving achievements: ' + (err.message || err));
    }
  };

  const buildReportData = (children) => {
    return children.map(child => {
      const achievements = (child.achievements || []).map(a => ({
        goalId: a.goal && a.goal.id ? a.goal.id : (a.goal || {}).id,
        goalName: (a.goal && a.goal.name) || (goalDetails.find(g => g.id === (a.goal && a.goal.id)) || {}).name || '',
        level: a.level || (achievementsMap[a.goal && a.goal.id] || 'NOT_STARTED'),
        notes: a.notes || ''
      }));

      return {
        childId: child.id,
        firstName: child.firstName || '',
        lastName: child.lastName || '',
        dateOfBirth: child.dateOfBirth || '',
        parentName: child.parent ? [child.parent.firstName, child.parent.lastName].filter(Boolean).join(' ') : '',
        doctors: (child.doctors || []).map(d => ({ id: d.id, firstName: d.firstName, lastName: d.lastName, email: d.email })),
        achievements
      };
    });
  };

  const openPrintPreview = (forAll = false) => {
    const data = forAll ? buildReportData(childDetails) : (selectedChild ? buildReportData([selectedChild]) : []);
    if (!data || !data.length) {
      alert('No data to print. Please select a child.');
      return;
    }

    const title = 'Achievements Report';
    const styles = `
      body { font-family: Arial, sans-serif; padding: 20px; }
      h1 { text-align: center; }
      .child { margin-bottom: 24px; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
      th { background: #f2f2f2; }
    `;

    const html = `
      <html>
        <head>
          <title>${title}</title>
          <style>${styles}</style>
        </head>
        <body>
          <h1>${title}</h1>
          <p>Generated: ${new Date().toLocaleString()}</p>
          ${data.map(c => `
            <div class="child">
              <h2>${c.firstName} ${c.lastName} (${c.childId})</h2>
              <p>DOB: ${c.dateOfBirth} | Parent: ${c.parentName} | Doctors: ${(c.doctors||[]).map(d=>d.email).join(', ')}</p>
              <table>
                <thead>
                  <tr><th>Goal Name</th><th>Goal ID</th><th>Level</th><th>Notes</th></tr>
                </thead>
                <tbody>
                  ${c.achievements && c.achievements.length ? c.achievements.map(a => `
                    <tr>
                      <td>${a.goalName || ''}</td>
                      <td>${a.goalId || ''}</td>
                      <td>${a.level || ''}</td>
                      <td>${a.notes || ''}</td>
                    </tr>
                  `).join('') : '<tr><td colspan="4">No achievements</td></tr>'}
                </tbody>
              </table>
            </div>
          `).join('')}
        </body>
      </html>
    `;

    // create hidden iframe to avoid opening a new tab
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.id = 'print-iframe';
    document.body.appendChild(iframe);

    try {
      const iDoc = iframe.contentDocument || iframe.contentWindow.document;
      iDoc.open();
      iDoc.write(html);
      iDoc.close();
      // give browser a moment to layout
      setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (e) {
          alert('Print failed: ' + e.message);
        } finally {
          // cleanup
          setTimeout(() => { document.body.removeChild(iframe); }, 500);
        }
      }, 500);
    } catch (e) {
      document.body.removeChild(iframe);
      alert('Printing is not available in this browser.');
    }
  };

  const getFullName = (child) => [child.firstName, child.lastName].filter(Boolean).join(' ');

  const handleChildSelect = (child) => {
    setSelectedChild(child);
    setSearchInput(getFullName(child));
    setAge(calculateAge(child.dateOfBirth).toString());
  };

  const handleAddNewChild = () => {
    setSelectedChild(null);
    setSearchInput('');
    setAge('');
  };

  const filteredChildren = childDetails.filter(child => new RegExp(searchInput, 'i').test(getFullName(child)));
  const shouldShowSuggestions = searchInput && !selectedChild && filteredChildren.length > 0;
  const [achievementsMap, setAchievementsMap] = useState({});

  useEffect(() => {
    if (!selectedChild) {
      setAchievementsMap({});
      return;
    }

    const sourceChild = selectedChild.achievements && selectedChild.achievements.length
      ? selectedChild
      : (childData.find(c => c.id === selectedChild.id) || {});

    const sourceAchievements = sourceChild.achievements || [];
    const map = {};
    sourceAchievements.forEach(a => {
      if (a && a.goal && a.goal.id) map[a.goal.id] = a.level || 'NOT_STARTED';
    });
    setAchievementsMap(map);
  }, [selectedChild]);

  const handleSetGoalLevel = (goalId, level) => {
    setAchievementsMap(prev => ({ ...prev, [goalId]: level }));
    if (!selectedChild) return;

    const existing = (selectedChild.achievements || []).findIndex(a => a.goal && a.goal.id === goalId);
    const updated = [...(selectedChild.achievements || [])];
    const now = new Date().toISOString();

    if (existing >= 0) {
      updated[existing] = { ...updated[existing], level, lastUpdatedAt: now };
    } else {
      updated.push({
        id: `local-${Math.random().toString(36).slice(2)}`,
        child: selectedChild.id,
        goal: { id: goalId },
        lastUpdatedAt: now,
        lastUpdatedBy: null,
        level,
        notes: ''
      });
    }

    setSelectedChild({ ...selectedChild, achievements: updated });
  };

  const AchievementDropdown = ({ goal, idSuffix }) => {
    const level = achievementsMap[goal.id] || null;
    const choices = ['NOT_STARTED', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'MASTER'];
    return (
      <Dropdown style={{ position: "absolute", right: 0 }}>
        <Dropdown.Toggle variant="success" id={`dropdown-${idSuffix}`}>
          {level || 'INTERMEDIATE'}
        </Dropdown.Toggle>
        <Dropdown.Menu>
          {choices.map(c => (
            <Dropdown.Item key={c} active={level === c} onClick={() => handleSetGoalLevel(goal.id, c)}>{c}</Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>
    );
  };
  const GROSS_MOTOR = goalDetails.filter((goal) => goal.domain === "GROSS_MOTOR");
  const FINE_MOTOR = goalDetails.filter((goal) => goal.domain === "FINE_MOTOR");
  const BALANCE_AND_COORDINATION = goalDetails.filter((goal) => goal.domain === "BALANCE_AND_COORDINATION");
  const SOCIAL_INTERACTION = goalDetails.filter((goal) => goal.domain === "SOCIAL_INTERACTION");
  const ADL = goalDetails.filter((goal) => goal.domain === "ADL");
  const PLAY_SKILL = goalDetails.filter((goal) => goal.domain === "PLAY_SKILL");
  const BRAIN_GYM = goalDetails.filter((goal) => goal.domain === "BRAIN_GYM");
  const HIGHER_FUNCTIONING = goalDetails.filter((goal) => goal.domain === "HIGHER_FUNCTIONING");
  const BILATERAL_INTEGRATION = goalDetails.filter((goal) => goal.domain === "BILATERAL_INTEGRATION");
  const SENSORY_INTEGRATION = goalDetails.filter((goal) => goal.domain === "SENSORY_INTEGRATION");
  const AGE_RANGES = [
    { min: 0, max: 6, label: "0 - 6 months" },
    { min: 6, max: 12, label: "6 - 12 months" },
    { min: 12, max: 18, label: "12 - 18 months" },
    { min: 18, max: 24, label: "18 - 24 months" },
    { min: 12, max: 24, label: "12 - 24 months" },
    { min: 24, max: 36, label: "24 - 36 months" },
    { min: 36, max: 48, label: "36 - 48 months" },
    { min: 48, max: 60, label: "48 - 60 months" },
    { min: 60, max: 72, label: "60 - 72 months" },
    { min: 72, max: 84, label: "72 - 84 months" },
    { min: 84, max: 96, label: "84 - 96 months" }
  ];

  return (
    <div className="dashboard">
      <Container fluid className="dashboard-container">
        <header className="dashboard-header">
          <h1>Grace</h1>
          <p>Childcare Management System</p>
        </header>

        {loading && (
          <Card className="dashboard-card">
            <Card.Body style={{ textAlign: 'center', padding: '2rem' }}>
              <p>Loading data...</p>
            </Card.Body>
          </Card>
        )}

        {error && (
          <Card className="dashboard-card">
            <Card.Body style={{ textAlign: 'center', padding: '2rem', color: 'red' }}>
              <p>Error: {error}</p>
              <p>Please check your API endpoints and try again.</p>
            </Card.Body>
          </Card>
        )}

        {!loading && !error && (
          <>
            <Card className="dashboard-card">
              <Card.Body>
                <Form>
                  <Form.Group className="mb-3 responsive-form-group">
                    <Form.Label>Child Name :</Form.Label>
                    <div className="responsive-input-wrapper">
                      <Form.Control
                        type="text"
                        placeholder="Search child name"
                        value={searchInput}
                        onChange={(e) => {
                          setSearchInput(e.target.value);
                          setSelectedChild(null);                        }}
                      />
                      {shouldShowSuggestions && (
                        <div className="suggestions">
                          {filteredChildren.map((child, idx) => (
                            <div key={idx} onClick={() => handleChildSelect(child)} className="suggestion-item">
                              {getFullName(child)}
                            </div>
                          ))}
                        </div>
                      )}
                      {searchInput && !selectedChild && filteredChildren.length === 0 && (
                        <div className="suggestions">
                          <div onClick={handleAddNewChild} className="suggestion-item" style={{ fontWeight: 'bold', color: '#007bff' }}>
                            + Add new child: {searchInput}
                          </div>
                        </div>
                      )}
                    </div>
                    <Form.Label>Age :</Form.Label>
                    <Form.Control
                      className="responsive-age-input"
                      type="text"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      disabled={selectedChild !== null}
                      placeholder={selectedChild ? 'Auto-calculated' : 'Enter age'}
                    />
                  </Form.Group>
                </Form>
              </Card.Body>
            </Card>

            <Card className="dashboard-card">
              <Card.Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h5 style={{ margin: 0 }}>Assesments</h5>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button disabled={!selectedChild} variant="primary" onClick={sendAchievements}>Save Achievements</Button>
                  <Button variant="outline-primary" disabled={!selectedChild} onClick={() => openPrintPreview(false)}>Print Report</Button>
                </div>
              </Card.Header>
              <Card.Body>
                <Accordion alwaysOpen>
                  <Accordion.Item eventKey="0">
                    <Accordion.Header>GROSS MOTOR</Accordion.Header>
                    <Accordion.Body>
                      <div className="goals-grid">
                        <Accordion alwaysOpen>
                          {AGE_RANGES.map(({ min, max, label }) => {
                            const goalsForRange = GROSS_MOTOR.filter(
                              goal => goal.minAgeMonths === min && goal.maxAgeMonths === max
                            );
                            if (!goalsForRange.length) return null;
                            return (
                              <Accordion.Item eventKey={`${min}-${max}`} key={`${min}-${max}`}>
                                <Accordion.Header>{label}</Accordion.Header>
                                <Accordion.Body>
                                  {goalsForRange.map((goal, idx) => (
                                    <div key={idx} className="goal-row" style={{ position: "relative" }}>
                                      <Form.Label className="goal-label">
                                        {goal.name}
                                      </Form.Label>
                                      <AchievementDropdown goal={goal} idSuffix={`${min}-${idx}`} />
                                    </div>
                                  ))}
                                </Accordion.Body>
                              </Accordion.Item>
                            );
                          })}
                        </Accordion>
                      </div>
                    </Accordion.Body>
                  </Accordion.Item>
                  <Accordion.Item eventKey="1">
                    <Accordion.Header>FINE MOTOR</Accordion.Header>
                    <Accordion.Body>
                      <div className="goals-grid">
                        <Accordion alwaysOpen>
                          {AGE_RANGES.map(({ min, max, label }) => {
                            const goalsForRange = FINE_MOTOR.filter(
                              goal => goal.minAgeMonths === min && goal.maxAgeMonths === max
                            );
                            if (!goalsForRange.length) return null;
                            return (
                              <Accordion.Item eventKey={`${min}-${max}`} key={`${min}-${max}`}>
                                <Accordion.Header>{label}</Accordion.Header>
                                <Accordion.Body>
                                  {goalsForRange.map((goal, idx) => (
                                    <div key={idx} className="goal-row" style={{ position: "relative" }}>
                                      <Form.Label className="goal-label">
                                        {goal.name}
                                      </Form.Label>
                                      <AchievementDropdown goal={goal} idSuffix={`${min}-${idx}`} />
                                    </div>
                                  ))}
                                </Accordion.Body>
                              </Accordion.Item>
                            );
                          })}
                        </Accordion>
                      </div>
                    </Accordion.Body>
                  </Accordion.Item>
                  <Accordion.Item eventKey="2">
                    <Accordion.Header>BALANCE AND COORDINATION</Accordion.Header>
                    <Accordion.Body>
                      <div className="goals-grid">
                        <Accordion alwaysOpen>
                          {AGE_RANGES.map(({ min, max, label }) => {
                            const goalsForRange = BALANCE_AND_COORDINATION.filter(
                              goal => goal.minAgeMonths === min && goal.maxAgeMonths === max
                            );
                            if (!goalsForRange.length) return null;
                            return (
                              <Accordion.Item eventKey={`${min}-${max}`} key={`${min}-${max}`}>
                                <Accordion.Header>{label}</Accordion.Header>
                                <Accordion.Body>
                                  {goalsForRange.map((goal, idx) => (
                                    <div key={idx} className="goal-row" style={{ position: "relative" }}>
                                      <Form.Label className="goal-label">
                                        {goal.name}
                                      </Form.Label>
                                      <AchievementDropdown goal={goal} idSuffix={`${min}-${idx}`} />
                                    </div>
                                  ))}
                                </Accordion.Body>
                              </Accordion.Item>
                            );
                          })}
                        </Accordion>
                      </div>
                    </Accordion.Body>
                  </Accordion.Item>
                  <Accordion.Item eventKey="3">
                    <Accordion.Header>SOCIAL INTERACTION</Accordion.Header>
                    <Accordion.Body>
                      <div className="goals-grid">
                        <Accordion alwaysOpen>
                          {AGE_RANGES.map(({ min, max, label }) => {
                            const goalsForRange = SOCIAL_INTERACTION.filter(
                              goal => goal.minAgeMonths === min && goal.maxAgeMonths === max
                            );
                            if (!goalsForRange.length) return null;
                            return (
                              <Accordion.Item eventKey={`${min}-${max}`} key={`${min}-${max}`}>
                                <Accordion.Header>{label}</Accordion.Header>
                                <Accordion.Body>
                                  {goalsForRange.map((goal, idx) => (
                                    <div key={idx} className="goal-row" style={{ position: "relative" }}>
                                      <Form.Label className="goal-label">
                                        {goal.name}
                                      </Form.Label>
                                      <AchievementDropdown goal={goal} idSuffix={`${min}-${idx}`} />
                                    </div>
                                  ))}
                                </Accordion.Body>
                              </Accordion.Item>
                            );
                          })}
                        </Accordion>
                      </div>
                    </Accordion.Body>
                  </Accordion.Item>
                  <Accordion.Item eventKey="4">
                    <Accordion.Header>ADL</Accordion.Header>
                    <Accordion.Body>
                      <div className="goals-grid">
                        <Accordion alwaysOpen>
                          <Accordion.Item eventKey="ADL-HYGIENE">
                            <Accordion.Header>Hygiene</Accordion.Header>
                            <Accordion.Body>
                              <div className="goals-grid">
                                <Accordion alwaysOpen>
                                  {AGE_RANGES.map(({ min, max, label }) => {
                                    const goalsForRange = ADL.filter(
                                      goal => goal.minAgeMonths === min && goal.maxAgeMonths === max && goal.area === "HYGIENE"
                                    );
                                    if (!goalsForRange.length) return null;
                                    return (
                                      <Accordion.Item eventKey={`${min}-${max}`} key={`${min}-${max}`}>
                                        <Accordion.Header>{label}</Accordion.Header>
                                        <Accordion.Body>
                                          {goalsForRange.map((goal, idx) => (
                                            <div key={idx} className="goal-row" style={{ position: "relative" }}>
                                              <Form.Label className="goal-label">
                                                {goal.name}
                                              </Form.Label>
                                              <AchievementDropdown goal={goal} idSuffix={`${min}-${idx}`} />
                                            </div>
                                          ))}
                                        </Accordion.Body>
                                      </Accordion.Item>
                                    );
                                  })}
                                </Accordion>
                              </div>
                            </Accordion.Body>
                          </Accordion.Item>
                          <Accordion.Item eventKey="ADL-DRESSING">
                            <Accordion.Header>Dressing</Accordion.Header>
                            <Accordion.Body>
                              <div className="goals-grid">
                                <Accordion alwaysOpen>
                                  {AGE_RANGES.map(({ min, max, label }) => {
                                    const goalsForRange = ADL.filter(
                                      goal => goal.minAgeMonths === min && goal.maxAgeMonths === max && goal.area === "DRESSING"
                                    );
                                    if (!goalsForRange.length) return null;
                                    return (
                                      <Accordion.Item eventKey={`${min}-${max}`} key={`${min}-${max}`}>
                                        <Accordion.Header>{label}</Accordion.Header>
                                        <Accordion.Body>
                                          {goalsForRange.map((goal, idx) => (
                                            <div key={idx} className="goal-row" style={{ position: "relative" }}>
                                              <Form.Label className="goal-label">
                                                {goal.name}
                                              </Form.Label>
                                              <AchievementDropdown goal={goal} idSuffix={`${min}-${idx}`} />
                                            </div>
                                          ))}
                                        </Accordion.Body>
                                      </Accordion.Item>
                                    );
                                  })}
                                </Accordion>
                              </div>
                            </Accordion.Body>
                          </Accordion.Item>
                          <Accordion.Item eventKey="ADL-TOILETING">
                            <Accordion.Header>Toileting</Accordion.Header>
                            <Accordion.Body>
                              <div className="goals-grid">
                                <Accordion alwaysOpen>
                                  {AGE_RANGES.map(({ min, max, label }) => {
                                    const goalsForRange = ADL.filter(
                                      goal => goal.minAgeMonths === min && goal.maxAgeMonths === max && goal.area === "TOILETING"
                                    );
                                    if (!goalsForRange.length) return null;
                                    return (
                                      <Accordion.Item eventKey={`${min}-${max}`} key={`${min}-${max}`}>
                                        <Accordion.Header>{label}</Accordion.Header>
                                        <Accordion.Body>
                                          {goalsForRange.map((goal, idx) => (
                                            <div key={idx} className="goal-row" style={{ position: "relative" }}>
                                              <Form.Label className="goal-label">
                                                {goal.name}
                                              </Form.Label>
                                              <AchievementDropdown goal={goal} idSuffix={`${min}-${idx}`} />
                                            </div>
                                          ))}
                                        </Accordion.Body>
                                      </Accordion.Item>
                                    );
                                  })}
                                </Accordion>
                              </div>
                            </Accordion.Body>
                          </Accordion.Item>
                          <Accordion.Item eventKey="ADL-EATING">
                            <Accordion.Header>Eating</Accordion.Header>
                            <Accordion.Body>
                              <div className="goals-grid">
                                <Accordion alwaysOpen>
                                  {AGE_RANGES.map(({ min, max, label }) => {
                                    const goalsForRange = ADL.filter(
                                      goal => goal.minAgeMonths === min && goal.maxAgeMonths === max && goal.area === "EATING"
                                    );
                                    if (!goalsForRange.length) return null;
                                    return (
                                      <Accordion.Item eventKey={`${min}-${max}`} key={`${min}-${max}`}>
                                        <Accordion.Header>{label}</Accordion.Header>
                                        <Accordion.Body>
                                          {goalsForRange.map((goal, idx) => (
                                            <div key={idx} className="goal-row" style={{ position: "relative" }}>
                                              <Form.Label className="goal-label">
                                                {goal.name}
                                              </Form.Label>
                                              <AchievementDropdown goal={goal} idSuffix={`${min}-${idx}`} />
                                            </div>
                                          ))}
                                        </Accordion.Body>
                                      </Accordion.Item>
                                    );
                                  })}
                                </Accordion>
                              </div>
                            </Accordion.Body>
                          </Accordion.Item>
                          <Accordion.Item eventKey="ADL-CONTINENCE">
                            <Accordion.Header>Continence</Accordion.Header>
                            <Accordion.Body>
                              <div className="goals-grid">
                                <Accordion alwaysOpen>
                                  {AGE_RANGES.map(({ min, max, label }) => {
                                    const goalsForRange = ADL.filter(
                                      goal => goal.minAgeMonths === min && goal.maxAgeMonths === max && goal.area === "CONTINENCE"
                                    );
                                    if (!goalsForRange.length) return null;
                                    return (
                                      <Accordion.Item eventKey={`${min}-${max}`} key={`${min}-${max}`}>
                                        <Accordion.Header>{label}</Accordion.Header>
                                        <Accordion.Body>
                                          {goalsForRange.map((goal, idx) => (
                                            <div key={idx} className="goal-row" style={{ position: "relative" }}>
                                              <Form.Label className="goal-label">
                                                {goal.name}
                                              </Form.Label>
                                              <AchievementDropdown goal={goal} idSuffix={`${min}-${idx}`} />
                                            </div>
                                          ))}
                                        </Accordion.Body>
                                      </Accordion.Item>
                                    );
                                  })}
                                </Accordion>
                              </div>
                            </Accordion.Body>
                          </Accordion.Item>
                          <Accordion.Item eventKey="ADL-MOBILITY">
                            <Accordion.Header>Mobility</Accordion.Header>
                            <Accordion.Body>
                              <div className="goals-grid">
                                <Accordion alwaysOpen>
                                  {AGE_RANGES.map(({ min, max, label }) => {
                                    const goalsForRange = ADL.filter(
                                      goal => goal.minAgeMonths === min && goal.maxAgeMonths === max && goal.area === "MOBILITY"
                                    );
                                    if (!goalsForRange.length) return null;
                                    return (
                                      <Accordion.Item eventKey={`${min}-${max}`} key={`${min}-${max}`}>
                                        <Accordion.Header>{label}</Accordion.Header>
                                        <Accordion.Body>
                                          {goalsForRange.map((goal, idx) => (
                                            <div key={idx} className="goal-row" style={{ position: "relative" }}>
                                              <Form.Label className="goal-label">
                                                {goal.name}
                                              </Form.Label>
                                              <AchievementDropdown goal={goal} idSuffix={`${min}-${idx}`} />
                                            </div>
                                          ))}
                                        </Accordion.Body>
                                      </Accordion.Item>
                                    );
                                  })}
                                </Accordion>
                              </div>
                            </Accordion.Body>
                          </Accordion.Item>
                        </Accordion>
                      </div>
                    </Accordion.Body>
                  </Accordion.Item>
                  <Accordion.Item eventKey="5">
                    <Accordion.Header>PLAY SKILL</Accordion.Header>
                    <Accordion.Body>
                      <div className="goals-grid">
                        <Accordion alwaysOpen>
                          {AGE_RANGES.map(({ min, max, label }) => {
                            const goalsForRange = PLAY_SKILL.filter(
                              goal => goal.minAgeMonths === min && goal.maxAgeMonths === max
                            );
                            if (!goalsForRange.length) return null;
                            return (
                              <Accordion.Item eventKey={`${min}-${max}`} key={`${min}-${max}`}>
                                <Accordion.Header>{label}</Accordion.Header>
                                <Accordion.Body>
                                  {goalsForRange.map((goal, idx) => (
                                    <div key={idx} className="goal-row" style={{ position: "relative" }}>
                                      <Form.Label className="goal-label">
                                        {goal.name}
                                      </Form.Label>
                                      <AchievementDropdown goal={goal} idSuffix={`${min}-${idx}`} />
                                    </div>
                                  ))}
                                </Accordion.Body>
                              </Accordion.Item>
                            );
                          })}
                        </Accordion>
                      </div>
                    </Accordion.Body>
                  </Accordion.Item>
                  <Accordion.Item eventKey="6">
                    <Accordion.Header>BRAIN GYM</Accordion.Header>
                    <Accordion.Body>
                      <div className="goals-grid">
                        <Accordion alwaysOpen>
                          {AGE_RANGES.map(({ min, max, label }) => {
                            const goalsForRange = BRAIN_GYM.filter(
                              goal => goal.minAgeMonths === min && goal.maxAgeMonths === max
                            );
                            if (!goalsForRange.length) return null;
                            return (
                              <Accordion.Item eventKey={`${min}-${max}`} key={`${min}-${max}`}>
                                <Accordion.Header>{label}</Accordion.Header>
                                <Accordion.Body>
                                  {goalsForRange.map((goal, idx) => (
                                    <div key={idx} className="goal-row" style={{ position: "relative" }}>
                                      <Form.Label className="goal-label">
                                        {goal.name}
                                      </Form.Label>
                                      <AchievementDropdown goal={goal} idSuffix={`${min}-${idx}`} />
                                    </div>
                                  ))}
                                </Accordion.Body>
                              </Accordion.Item>
                            );
                          })}
                        </Accordion>
                      </div>
                    </Accordion.Body>
                  </Accordion.Item>
                  <Accordion.Item eventKey="7">
                    <Accordion.Header>HIGHER FUNCTIONING</Accordion.Header>
                    <Accordion.Body>
                      <div className="goals-grid">
                        <Accordion alwaysOpen>
                          {AGE_RANGES.map(({ min, max, label }) => {
                            const goalsForRange = HIGHER_FUNCTIONING.filter(
                              goal => goal.minAgeMonths === min && goal.maxAgeMonths === max
                            );
                            if (!goalsForRange.length) return null;
                            return (
                              <Accordion.Item eventKey={`${min}-${max}`} key={`${min}-${max}`}>
                                <Accordion.Header>{label}</Accordion.Header>
                                <Accordion.Body>
                                  {goalsForRange.map((goal, idx) => (
                                    <div key={idx} className="goal-row" style={{ position: "relative" }}>
                                      <Form.Label className="goal-label">
                                        {goal.name}
                                      </Form.Label>
                                      <AchievementDropdown goal={goal} idSuffix={`${min}-${idx}`} />
                                    </div>
                                  ))}
                                </Accordion.Body>
                              </Accordion.Item>
                            );
                          })}
                        </Accordion>
                      </div>
                    </Accordion.Body>
                  </Accordion.Item>
                  <Accordion.Item eventKey="8">
                    <Accordion.Header>BILATERAL INTEGRATION</Accordion.Header>
                    <Accordion.Body>
                      <div className="goals-grid">
                        <Accordion alwaysOpen>
                          {AGE_RANGES.map(({ min, max, label }) => {
                            const goalsForRange = BILATERAL_INTEGRATION.filter(
                              goal => goal.minAgeMonths === min && goal.maxAgeMonths === max
                            );
                            if (!goalsForRange.length) return null;
                            return (
                              <Accordion.Item eventKey={`${min}-${max}`} key={`${min}-${max}`}>
                                <Accordion.Header>{label}</Accordion.Header>
                                <Accordion.Body>
                                  {goalsForRange.map((goal, idx) => (
                                    <div key={idx} className="goal-row" style={{ position: "relative" }}>
                                      <Form.Label className="goal-label">
                                        {goal.name}
                                      </Form.Label>
                                      <AchievementDropdown goal={goal} idSuffix={`${min}-${idx}`} />
                                    </div>
                                  ))}
                                </Accordion.Body>
                              </Accordion.Item>
                            );
                          })}
                        </Accordion>
                      </div>
                    </Accordion.Body>
                  </Accordion.Item>
                  <Accordion.Item eventKey="9">
                    <Accordion.Header>SENSORY INTEGRATION</Accordion.Header>
                    <Accordion.Body>
                      <div className="goals-grid">
                        <Accordion alwaysOpen>
                          <Accordion.Item eventKey="SENSORY-TACTILE">
                            <Accordion.Header>TACTILE</Accordion.Header>
                            <Accordion.Body>
                              <div className="goals-grid">
                                <Accordion alwaysOpen>
                                  {AGE_RANGES.map(({ min, max, label }) => {
                                    const goalsForRange = SENSORY_INTEGRATION.filter(
                                      goal => goal.minAgeMonths === min && goal.maxAgeMonths === max && goal.area === "TACTILE"
                                    );
                                    if (!goalsForRange.length) return null;
                                    return (
                                      <Accordion.Item eventKey={`${min}-${max}`} key={`${min}-${max}`}>
                                        <Accordion.Header>{label}</Accordion.Header>
                                        <Accordion.Body>
                                          {goalsForRange.map((goal, idx) => (
                                            <div key={idx} className="goal-row" style={{ position: "relative" }}>
                                              <Form.Label className="goal-label">
                                                {goal.name}
                                              </Form.Label>
                                              <AchievementDropdown goal={goal} idSuffix={`${min}-${idx}`} />
                                            </div>
                                          ))}
                                        </Accordion.Body>
                                      </Accordion.Item>
                                    );
                                  })}
                                </Accordion>
                              </div>
                            </Accordion.Body>
                          </Accordion.Item>
                          <Accordion.Item eventKey="SENSORY-VESTIBULAR">
                            <Accordion.Header>VESTIBULAR</Accordion.Header>
                            <Accordion.Body>
                              <div className="goals-grid">
                                <Accordion alwaysOpen>
                                  {AGE_RANGES.map(({ min, max, label }) => {
                                    const goalsForRange = SENSORY_INTEGRATION.filter(
                                      goal => goal.minAgeMonths === min && goal.maxAgeMonths === max && goal.area === "VESTIBULAR"
                                    );
                                    if (!goalsForRange.length) return null;
                                    return (
                                      <Accordion.Item eventKey={`${min}-${max}`} key={`${min}-${max}`}>
                                        <Accordion.Header>{label}</Accordion.Header>
                                        <Accordion.Body>
                                          {goalsForRange.map((goal, idx) => (
                                            <div key={idx} className="goal-row" style={{ position: "relative" }}>
                                              <Form.Label className="goal-label">
                                                {goal.name}
                                              </Form.Label>
                                              <AchievementDropdown goal={goal} idSuffix={`${min}-${idx}`} />
                                            </div>
                                          ))}
                                        </Accordion.Body>
                                      </Accordion.Item>
                                    );
                                  })}
                                </Accordion>
                              </div>
                            </Accordion.Body>
                          </Accordion.Item>
                          <Accordion.Item eventKey="SENSORY-PROPRIOCEPTIVE">
                            <Accordion.Header>PROPRIOCEPTIVE</Accordion.Header>
                            <Accordion.Body>
                              <div className="goals-grid">
                                <Accordion alwaysOpen>
                                  {AGE_RANGES.map(({ min, max, label }) => {
                                    const goalsForRange = SENSORY_INTEGRATION.filter(
                                      goal => goal.minAgeMonths === min && goal.maxAgeMonths === max && goal.area === "PROPRIOCEPTIVE"
                                    );
                                    if (!goalsForRange.length) return null;
                                    return (
                                      <Accordion.Item eventKey={`${min}-${max}`} key={`${min}-${max}`}>
                                        <Accordion.Header>{label}</Accordion.Header>
                                        <Accordion.Body>
                                          {goalsForRange.map((goal, idx) => (
                                            <div key={idx} className="goal-row" style={{ position: "relative" }}>
                                              <Form.Label className="goal-label">
                                                {goal.name}
                                              </Form.Label>
                                              <AchievementDropdown goal={goal} idSuffix={`${min}-${idx}`} />
                                            </div>
                                          ))}
                                        </Accordion.Body>
                                      </Accordion.Item>
                                    );
                                  })}
                                </Accordion>
                              </div>
                            </Accordion.Body>
                          </Accordion.Item>
                          <Accordion.Item eventKey="SENSORY-VISUAL">
                            <Accordion.Header>VISUAL</Accordion.Header>
                            <Accordion.Body>
                              <div className="goals-grid">
                                <Accordion alwaysOpen>
                                  {AGE_RANGES.map(({ min, max, label }) => {
                                    const goalsForRange = SENSORY_INTEGRATION.filter(
                                      goal => goal.minAgeMonths === min && goal.maxAgeMonths === max && goal.area === "VISUAL"
                                    );
                                    if (!goalsForRange.length) return null;
                                    return (
                                      <Accordion.Item eventKey={`${min}-${max}`} key={`${min}-${max}`}>
                                        <Accordion.Header>{label}</Accordion.Header>
                                        <Accordion.Body>
                                          {goalsForRange.map((goal, idx) => (
                                            <div key={idx} className="goal-row" style={{ position: "relative" }}>
                                              <Form.Label className="goal-label">
                                                {goal.name}
                                              </Form.Label>
                                              <AchievementDropdown goal={goal} idSuffix={`${min}-${idx}`} />
                                            </div>
                                          ))}
                                        </Accordion.Body>
                                      </Accordion.Item>
                                    );
                                  })}
                                </Accordion>
                              </div>
                            </Accordion.Body>
                          </Accordion.Item>
                          <Accordion.Item eventKey="SENSORY-AUDITORY">
                            <Accordion.Header>AUDITORY</Accordion.Header>
                            <Accordion.Body>
                              <div className="goals-grid">
                                <Accordion alwaysOpen>
                                  {AGE_RANGES.map(({ min, max, label }) => {
                                    const goalsForRange = SENSORY_INTEGRATION.filter(
                                      goal => goal.minAgeMonths === min && goal.maxAgeMonths === max && goal.area === "AUDITORY"
                                    );
                                    if (!goalsForRange.length) return null;
                                    return (
                                      <Accordion.Item eventKey={`${min}-${max}`} key={`${min}-${max}`}>
                                        <Accordion.Header>{label}</Accordion.Header>
                                        <Accordion.Body>
                                          {goalsForRange.map((goal, idx) => (
                                            <div key={idx} className="goal-row" style={{ position: "relative" }}>
                                              <Form.Label className="goal-label">
                                                {goal.name}
                                              </Form.Label>
                                              <AchievementDropdown goal={goal} idSuffix={`${min}-${idx}`} />
                                            </div>
                                          ))}
                                        </Accordion.Body>
                                      </Accordion.Item>
                                    );
                                  })}
                                </Accordion>
                              </div>
                            </Accordion.Body>
                          </Accordion.Item>
                          <Accordion.Item eventKey="SENSORY-OLFACTORY">
                            <Accordion.Header>OLFACTORY</Accordion.Header>
                            <Accordion.Body>
                              <div className="goals-grid">
                                <Accordion alwaysOpen>
                                  {AGE_RANGES.map(({ min, max, label }) => {
                                    const goalsForRange = SENSORY_INTEGRATION.filter(
                                      goal => goal.minAgeMonths === min && goal.maxAgeMonths === max && goal.area === "OLFACTORY"
                                    );
                                    if (!goalsForRange.length) return null;
                                    return (
                                      <Accordion.Item eventKey={`${min}-${max}`} key={`${min}-${max}`}>
                                        <Accordion.Header>{label}</Accordion.Header>
                                        <Accordion.Body>
                                          {goalsForRange.map((goal, idx) => (
                                            <div key={idx} className="goal-row" style={{ position: "relative" }}>
                                              <Form.Label className="goal-label">
                                                {goal.name}
                                              </Form.Label>
                                              <AchievementDropdown goal={goal} idSuffix={`${min}-${idx}`} />
                                            </div>
                                          ))}
                                        </Accordion.Body>
                                      </Accordion.Item>
                                    );
                                  })}
                                </Accordion>
                              </div>
                            </Accordion.Body>
                          </Accordion.Item>
                          <Accordion.Item eventKey="SENSORY-GUSTATORY">
                            <Accordion.Header>GUSTATORY</Accordion.Header>
                            <Accordion.Body>
                              <div className="goals-grid">
                                <Accordion alwaysOpen>
                                  {AGE_RANGES.map(({ min, max, label }) => {
                                    const goalsForRange = SENSORY_INTEGRATION.filter(
                                      goal => goal.minAgeMonths === min && goal.maxAgeMonths === max && goal.area === "GUSTATORY"
                                    );
                                    if (!goalsForRange.length) return null;
                                    return (
                                      <Accordion.Item eventKey={`${min}-${max}`} key={`${min}-${max}`}>
                                        <Accordion.Header>{label}</Accordion.Header>
                                        <Accordion.Body>
                                          {goalsForRange.map((goal, idx) => (
                                            <div key={idx} className="goal-row" style={{ position: "relative" }}>
                                              <Form.Label className="goal-label">
                                                {goal.name}
                                              </Form.Label>
                                              <AchievementDropdown goal={goal} idSuffix={`${min}-${idx}`} />
                                            </div>
                                          ))}
                                        </Accordion.Body>
                                      </Accordion.Item>
                                    );
                                  })}
                                </Accordion>
                              </div>
                            </Accordion.Body>
                          </Accordion.Item>
                        </Accordion>
                      </div>
                    </Accordion.Body>
                  </Accordion.Item>
                </Accordion>
              </Card.Body>
            </Card>
          </>
        )}
      </Container>
    </div>
  );
};

export default Dashboard;