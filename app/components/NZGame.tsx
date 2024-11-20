import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  FlatList,
  Animated,
  Platform,
  Easing,
  SafeAreaView,
} from 'react-native';

// Import the HighScores type
type HighScore = {
  score: number;
  date: string;
  playerName: string;
  gameMode: 'flies' | 'nz-challenge';
};

type HighScores = {
  flies: {
    [key: number]: HighScore[];
  };
  'nz-challenge': HighScore[];
};

// Type definitions
interface NZGameProps {
  onGameOver: (score: number) => void;
  onExit: () => void;
  highScores: HighScores;
}

interface Difficulty {
  name: string;
  gridSize: number;
  timeLimit: number;
  basePoints: number;
  nColors: string[];
  zColors: string[];
  requiredScore: number;
}

type GameStatus = 'idle' | 'playing' | 'ended';

// Constants
const DIFFICULTIES: Difficulty[] = [
  {
    name: 'Level 1',
    gridSize: 3,
    timeLimit: 20,
    basePoints: 50,
    nColors: ['#2E4052', '#2C3E50', '#34495E'], // Dark blue-grays
    zColors: ['#283747', '#2E4053', '#2C3E50'], // Similar dark blue-grays
    requiredScore: 0
  },
  {
    name: 'Level 2',
    gridSize: 4,
    timeLimit: 15,
    basePoints: 100,
    nColors: ['#4A5568', '#4F5B6A', '#526172'], // Medium blue-grays
    zColors: ['#4D5C6F', '#4A5568', '#505D70'], // Similar medium blue-grays
    requiredScore: 1000
  },
  {
    name: 'Level 3',
    gridSize: 5,
    timeLimit: 12,
    basePoints: 150,
    nColors: ['#556B2F', '#4F6228', '#526B2F'], // Dark olive greens
    zColors: ['#4F6228', '#526B2F', '#587030'], // Similar olive greens
    requiredScore: 3000
  },
  {
    name: 'Level 4',
    gridSize: 6,
    timeLimit: 10,
    basePoints: 200,
    nColors: ['#614A41', '#5D4740', '#664C43'], // Brown tones
    zColors: ['#5F4B42', '#614A41', '#5A443C'], // Similar browns
    requiredScore: 6000
  },
  {
    name: 'Level 5',
    gridSize: 7,
    timeLimit: 8,
    basePoints: 300,
    nColors: ['#4A4A4A', '#484848', '#4C4C4C'], // Dark grays
    zColors: ['#494949', '#4B4B4B', '#474747'], // Very similar grays
    requiredScore: 10000
  },
  {
    name: 'Master',
    gridSize: 8,
    timeLimit: 6,
    basePoints: 500,
    nColors: ['#444444', '#434343', '#454545'], // Nearly identical grays
    zColors: ['#434343', '#444444', '#424242'], // Extremely similar grays
    requiredScore: 15000
  }
];

// Increase rotation range to make it harder
const getRotation = () => Math.random() * 60 - 30; // Random rotation between // -30° to 30°

// Helper function to get random color from array
const getRandomColor = (colors: string[]) => {
  return colors[Math.floor(Math.random() * colors.length)];
};

const getRandomColorFromArray = (colors: string[]) => {
  const randomIndex = Math.floor(Math.random() * colors.length);
  return colors[randomIndex];
};

// Define a type for our easing functions
type EasingFunction = (value: number) => number;

// Add array of possible easing functions
const easingOptions: EasingFunction[] = [
  Easing.linear,
  Easing.ease,
  Easing.quad,
  Easing.bounce,
  Easing.elastic(1),
  Easing.sin,
  Easing.back(1.5),
  Easing.cubic,
];

// Add these constants at the top of the file
const TIME_BONUS_FOR_Z = 1; // Add 1 second when finding a Z
const TIME_PENALTY_FOR_MISS = -3; // Subtract 3 seconds when missing a Z

export function NZGame({ onGameOver, onExit, highScores }: NZGameProps) {
  // State declarations
  const [currentLevel, setCurrentLevel] = useState<number>(0);
  const [grid, setGrid] = useState<string[]>([]);
  const [score, setScore] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(DIFFICULTIES[0].timeLimit);
  const [gameStatus, setGameStatus] = useState<GameStatus>('idle');
  const [roundStartTime, setRoundStartTime] = useState<number>(Date.now());
  const [zPosition, setZPosition] = useState<number>(-1);
  const successAnim = new Animated.Value(0);
  const [totalScore, setTotalScore] = useState<number>(0);
  const [availableLevels, setAvailableLevels] = useState<number[]>([0]);
  const [lastRoundScore, setLastRoundScore] = useState<number>(0);
  const [showScoreBreakdown, setShowScoreBreakdown] = useState<boolean>(false);
  const [showUnlockMessage, setShowUnlockMessage] = useState<boolean>(false);
  const [unlockedLevel, setUnlockedLevel] = useState<number | null>(null);
  const [rotations, setRotations] = useState<number[]>([]);
  const [letterColors, setLetterColors] = useState<string[]>([]);
  const [animations] = useState(() => 
    Array(64).fill(0).map(() => new Animated.Value(0))
  );
  const [letterEasings, setLetterEasings] = useState<EasingFunction[]>([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // At the start of your component, initialize availableLevels based on the highest score
  useEffect(() => {
    // Get the highest score from nz-challenge
    const highestScore = highScores?.['nz-challenge']?.[0]?.score || 0;
    console.log('Highest NZ Challenge score:', highestScore);

    // Calculate available levels based on highest score
    const newAvailableLevels = DIFFICULTIES.reduce((acc: number[], diff, index) => {
      if (highestScore >= diff.requiredScore) {
        acc.push(index);
        console.log(`Level ${index} unlocked with score ${highestScore}`);
      }
      return acc;
    }, []);

    console.log('Setting available levels:', newAvailableLevels);
    setAvailableLevels(newAvailableLevels);
  }, []); // Run once on component mount

  // Define generateGrid first since other functions depend on it
  const generateGrid = useCallback(() => {
    const difficulty = DIFFICULTIES[currentLevel];
    const size = difficulty.gridSize * difficulty.gridSize;
    const newGrid = Array(size).fill('N');
    const newZPosition = Math.floor(Math.random() * size);
    
    // Generate rotations for each letter
    const rotations = Array(size).fill(0).map(() => getRotation());
    
    // Generate random easing function for each letter
    const newEasings = Array(size).fill(0).map(() => 
      easingOptions[Math.floor(Math.random() * easingOptions.length)]
    );
    
    setZPosition(newZPosition);
    setGrid(newGrid);
    setRotations(rotations);
    setLetterEasings(newEasings);
  }, [currentLevel]);

  // Update handleLetterPress to properly track and unlock levels
  const handleLetterPress = useCallback((index: number) => {
    if (gameStatus !== 'playing') return;
    
    if (index === zPosition) {
      // Found Z - add time bonus
      setTimeLeft(prevTime => {
        const newTime = prevTime + TIME_BONUS_FOR_Z;
        console.log('Added time bonus:', TIME_BONUS_FOR_Z, 'New time:', newTime);
        return newTime;
      });
      
      // Show success message
      setSuccessMessage(`Found Z! +${TIME_BONUS_FOR_Z} seconds`);
      setTimeout(() => setSuccessMessage(''), 1000);

      // Calculate and update score
      const timeTaken = (Date.now() - roundStartTime) / 1000;
      const difficulty = DIFFICULTIES[currentLevel];
      const timeBonus = Math.max(0, difficulty.timeLimit - timeTaken);
      const speedMultiplier = 1 + (timeBonus / difficulty.timeLimit);
      const gridSizeMultiplier = difficulty.gridSize * difficulty.gridSize / 9;
      const roundScore = Math.floor(
        difficulty.basePoints * 
        speedMultiplier * 
        gridSizeMultiplier
      );
      
      setScore(prevScore => prevScore + roundScore);
      
      // Generate new grid
      generateGrid();
      setRoundStartTime(Date.now());
    } else {
      // Missed Z - subtract time
      setTimeLeft(prevTime => {
        const newTime = Math.max(0, prevTime + TIME_PENALTY_FOR_MISS);
        console.log('Added time penalty:', TIME_PENALTY_FOR_MISS, 'New time:', newTime);
        return newTime;
      });
      
      // Show error message
      setErrorMessage(`Wrong! ${TIME_PENALTY_FOR_MISS} seconds`);
      setTimeout(() => setErrorMessage(''), 1000);
    }
  }, [zPosition, gameStatus, generateGrid, currentLevel, roundStartTime]);

  // Add a useEffect to monitor score changes
  useEffect(() => {
    console.log('Score updated:', score);
    console.log('Available levels:', availableLevels);
    
    // Check level unlocks whenever score changes
    const newAvailableLevels = [...availableLevels];
    let unlockedNew = false;
    
    DIFFICULTIES.forEach((diff, idx) => {
      if (!newAvailableLevels.includes(idx) && score >= diff.requiredScore) {
        console.log(`Unlocking level ${idx + 1} - Score: ${score}, Required: ${diff.requiredScore}`);
        newAvailableLevels.push(idx);
        unlockedNew = true;
      }
    });
    
    if (unlockedNew) {
      console.log('Setting new available levels:', newAvailableLevels);
      setAvailableLevels(newAvailableLevels);
    }
  }, [score]);

  // Add visual feedback for unlocks
  useEffect(() => {
    if (unlockedLevel !== null) {
      setShowUnlockMessage(true);
      const timer = setTimeout(() => {
        setShowUnlockMessage(false);
        setUnlockedLevel(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [unlockedLevel]);

  // Add this function to handle level selection
  const handleLevelSelect = (index: number) => {
    setCurrentLevel(index);
    setTimeLeft(DIFFICULTIES[index].timeLimit);
  };

  // Update handleGameStart
  const handleGameStart = () => {
    setGameStatus('playing');
    setScore(0);
    setTimeLeft(DIFFICULTIES[currentLevel].timeLimit);
    setRoundStartTime(Date.now());
    generateGrid();
  };

  // Update handleGameOver
  const handleGameOver = useCallback(() => {
    console.log('Game Over - Final Score:', score); // Debug log
    setGameStatus('ended');
    onGameOver(score);
  }, [score, onGameOver]);

  // Update handlePlayAgain
  const handlePlayAgain = () => {
    setGameStatus('idle');
    setScore(0);
    setTimeLeft(DIFFICULTIES[currentLevel].timeLimit);
  };

  // Update handleExitToMenu
  const handleExitToMenu = () => {
    onGameOver(score);
    onExit();
  };

  // Add this useEffect to initialize the game
  useEffect(() => {
    if (gameStatus === 'playing') {
      generateGrid();
    }
  }, [gameStatus, generateGrid]);

  // Update the timer effect to be independent of letter presses
  useEffect(() => {
    let startTime = Date.now();
    let frameId: number;

    const updateTimer = () => {
      if (gameStatus === 'playing' && timeLeft > 0) {
        const currentTime = Date.now();
        const elapsed = (currentTime - startTime) / 1000;
        startTime = currentTime;
        
        setTimeLeft(prev => {
          const newTime = Math.max(0, prev - elapsed);
          console.log('Timer update - Current time:', newTime);
          if (newTime <= 0) {
            handleGameOver();
            return 0;
          }
          return newTime;
        });
        
        frameId = requestAnimationFrame(updateTimer);
      }
    };

    if (gameStatus === 'playing' && timeLeft > 0) {
      frameId = requestAnimationFrame(updateTimer);
    }

    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [gameStatus, handleGameOver]);

  // Add debug logging for level unlocking
  useEffect(() => {
    console.log('Available levels:', availableLevels);
    console.log('Current score:', score);
  }, [availableLevels, score]);

  // Create wiggle animation
  const startWiggleAnimations = useCallback(() => {
    const animationSequence = animations.map((anim, index) => 
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 150 + Math.random() * 500,
          easing: letterEasings[index] || Easing.sin, // Use random easing or fallback
          useNativeDriver: true
        }),
        Animated.timing(anim, {
          toValue: -1,
          duration: 150 + Math.random() * 500,
          easing: letterEasings[index] || Easing.sin,
          useNativeDriver: true
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 150 + Math.random() * 500,
          easing: letterEasings[index] || Easing.sin,
          useNativeDriver: true
        })
      ])
    );

    Animated.parallel(
      animationSequence.map(anim => 
        Animated.loop(anim, { iterations: -1 })
      )
    ).start();
  }, [animations, letterEasings]);

  // Start animations when game starts
  useEffect(() => {
    if (gameStatus === 'playing') {
      startWiggleAnimations();
    }
  }, [gameStatus, startWiggleAnimations]);

  // Add debug logging to see which easing is used
  useEffect(() => {
    if (gameStatus === 'playing') {
      console.log('Current level easings:', letterEasings.map(e => 
        easingOptions.indexOf(e)
      ));
    }
  }, [letterEasings, gameStatus]);

  // Render grid item
  const renderItem = useCallback(({ item, index }: { item: string; index: number }) => {
    const difficulty = DIFFICULTIES[currentLevel];
    const screenWidth = Dimensions.get('window').width;
    const screenHeight = Dimensions.get('window').height - 200; // Increased header offset
    const maxSize = Math.min(screenWidth, screenHeight);
    const padding = 40;
    const itemSize = (maxSize - padding) / difficulty.gridSize;

    return (
      <TouchableOpacity
        onPress={() => handleLetterPress(index)}
        style={[
          styles.gridItem,
          {
            width: itemSize,
            height: itemSize,
            backgroundColor: '#ffffff',
          },
        ]}
      >
        <Text
          style={[
            styles.letter,
            {
              color: item === 'Z' ? 
                getRandomColorFromArray(difficulty.zColors) : 
                getRandomColorFromArray(difficulty.nColors),
              fontSize: itemSize * 0.7,
            },
          ]}
        >
          {item}
        </Text>
      </TouchableOpacity>
    );
  }, [currentLevel, handleLetterPress]);

  // Update the level selection UI
  const renderLevelSelection = () => (
    <View style={styles.menu}>
      <TouchableOpacity 
        style={styles.backButton}
        onPress={onExit}
      >
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.instructions}>
        Find the letter 'Z' among the 'N's as quickly as possible!
      </Text>
      <Text style={styles.totalScore}>Total Score: {totalScore}</Text>
      <Text style={styles.levelHeader}>Select Level:</Text>
      {DIFFICULTIES.map((diff, index) => (
        <TouchableOpacity
          key={index}
          style={[
            styles.difficultyButton,
            currentLevel === index && styles.selectedDifficulty,
            !availableLevels.includes(index) && styles.lockedLevel
          ]}
          onPress={() => availableLevels.includes(index) && handleLevelSelect(index)}
          disabled={!availableLevels.includes(index)}
        >
          <Text style={[
            styles.buttonText,
            !availableLevels.includes(index) && styles.lockedText
          ]}>
            {diff.name}
            {!availableLevels.includes(index) && ` (Unlock at ${diff.requiredScore} pts)`}
          </Text>
          <Text style={styles.levelDetails}>
            Grid: {diff.gridSize}x{diff.gridSize} • Time: {diff.timeLimit}s
          </Text>
        </TouchableOpacity>
      ))}
      {availableLevels.includes(currentLevel) && (
        <TouchableOpacity 
          style={styles.startButton} 
          onPress={handleGameStart}
        >
          <Text style={styles.buttonText}>Start Game</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // Update the grid rendering to include rotations
  const renderGrid = () => {
    const difficulty = DIFFICULTIES[currentLevel];
    const size = difficulty.gridSize;
    
    return (
      <View style={styles.grid}>
        {grid.map((letter, index) => {
          const wiggle = animations[index].interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [`-${5 + currentLevel * 2}deg`, '0deg', `${5 + currentLevel * 2}deg`]
          });

          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.letterContainer,
                {
                  width: `${100 / size}%`,
                  height: `${100 / size}%`,
                }
              ]}
              onPress={() => handleLetterPress(index)}
            >
              <Animated.View
                style={[
                  styles.letterWrapper,
                  {
                    transform: [
                      { rotate: wiggle },
                      { rotate: `${rotations[index]}deg` }
                    ]
                  }
                ]}
              >
                <Text
                  style={[
                    styles.letterText,
                    {
                      color: index === zPosition ? 
                        getRandomColor(difficulty.zColors) : 
                        getRandomColor(difficulty.nColors),
                      fontSize: Math.min(400 / size, 60)
                    }
                  ]}
                >
                  {index === zPosition ? 'Z' : letter}
                </Text>
              </Animated.View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  // Add this effect to handle game over
  useEffect(() => {
    if (gameStatus === 'ended') {
      // Delay the onGameOver call to avoid the render error
      const timer = setTimeout(() => {
        onGameOver(score);
      }, 0);
      
      return () => clearTimeout(timer);
    }
  }, [gameStatus, score, onGameOver]);

  // Move exit handler to a proper event handler
  const handleExit = () => {
    // Delay the onExit call to avoid the render error
    setTimeout(onExit, 0);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {gameStatus === 'playing' && (
          <View style={styles.gameHeader}>
            <View style={styles.headerContent}>
              <View style={styles.headerItem}>
                <Text style={styles.headerLabel}>Score</Text>
                <Text style={styles.headerValue}>{score}</Text>
              </View>
              <View style={styles.headerItem}>
                <Text style={styles.headerLabel}>Time</Text>
                <Text style={styles.headerValue}>{Math.ceil(timeLeft)}s</Text>
              </View>
              <View style={styles.headerItem}>
                <Text style={styles.headerLabel}>Level</Text>
                <Text style={styles.headerValue}>{DIFFICULTIES[currentLevel].name}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Menu Screen */}
        {gameStatus === 'idle' && renderLevelSelection()}

        {/* Game Grid */}
        {gameStatus === 'playing' && (
          <View style={styles.gameArea}>
            <View style={styles.gridWrapper}>
              {renderGrid()}
            </View>
          </View>
        )}

        {/* Game Over Screen */}
        {gameStatus === 'ended' && (
          <View style={styles.gameOverContainer}>
            <View style={styles.gameOverContent}>
              <Text style={styles.gameOverText}>Game Over!</Text>
              <Text style={styles.finalScore}>Final Score: {score}</Text>
              <TouchableOpacity 
                style={styles.startButton} 
                onPress={handlePlayAgain}
              >
                <Text style={styles.buttonText}>Play Again</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.startButton, { marginTop: 10, backgroundColor: '#666' }]} 
                onPress={handleExitToMenu}
              >
                <Text style={styles.buttonText}>Exit to Main Menu</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {showScoreBreakdown && (
          <View style={styles.scoreBreakdown}>
            <Text style={styles.breakdownText}>Last Find: +{lastRoundScore}</Text>
            <Text style={styles.breakdownDetails}>
              Base: {DIFFICULTIES[currentLevel].basePoints} • 
              Grid: {DIFFICULTIES[currentLevel].gridSize}x{DIFFICULTIES[currentLevel].gridSize}
            </Text>
          </View>
        )}

        {showUnlockMessage && unlockedLevel !== null && (
          <View style={styles.unlockMessage}>
            <Text style={styles.unlockText}>
              {`Level ${DIFFICULTIES[unlockedLevel].name} Unlocked! 🎉`}
            </Text>
          </View>
        )}

        {/* Update exit button to use the new handler */}
        <TouchableOpacity 
          style={styles.exitButton} 
          onPress={handleExit}
        >
          <Text style={styles.buttonText}>Exit</Text>
        </TouchableOpacity>

        {(successMessage || errorMessage) && (
          <View style={styles.messageContainer}>
            {successMessage ? (
              <View style={styles.successMessageWrapper}>
                <Text style={styles.successMessage}>{successMessage}</Text>
              </View>
            ) : errorMessage ? (
              <View style={styles.errorMessageWrapper}>
                <Text style={styles.errorMessage}>{errorMessage}</Text>
              </View>
            ) : null}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

// Update styles
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#333',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingBottom: Platform.OS === 'ios' ? 30 : 20, // Add bottom padding for buttons
  },
  gameHeader: {
    width: '100%',
    backgroundColor: '#333',
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 5,
  },
  headerItem: {
    alignItems: 'center',
  },
  headerLabel: {
    color: '#fff', // Changed from #999 to white for better visibility
    fontSize: 16, // Increased from 14
    marginBottom: 4,
    fontWeight: '600', // Added font weight
  },
  headerValue: {
    color: '#fff',
    fontSize: 28, // Increased from 24
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.3)', // Added text shadow for better readability
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  startButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    width: '80%',
    marginTop: 20,
    marginBottom: 30, // Added bottom margin
    alignItems: 'center',
    alignSelf: 'center', // Center horizontally
  },
  menu: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    paddingBottom: Platform.OS === 'ios' ? 50 : 30, // Added more bottom padding for menu
  },
  gameArea: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 40,
  },
  gridWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginVertical: 10,
  },
  gridContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridItem: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    margin: 1,
  },
  letter: {
    fontWeight: 'bold',
    textAlign: 'center',
  },
  exitButton: {
    position: 'absolute',
    left: 10,
    top: Platform.OS === 'ios' ? 0 : 10,
    padding: 10,
  },
  exitButtonText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  instructions: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 30,
  },
  difficultyButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    width: '100%',
    maxWidth: 300,
    marginVertical: 10,
    alignItems: 'center',
  },
  selectedDifficulty: {
    backgroundColor: '#2E7D32',
    borderWidth: 2,
    borderColor: '#fff',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  gameOverContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  gameOverContent: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 30,
    borderRadius: 15,
    alignItems: 'center',
    width: '80%',
    maxWidth: 300,
  },
  gameOverText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  finalScore: {
    fontSize: 24,
    color: '#fff',
    marginBottom: 30,
    textAlign: 'center',
  },
  levelHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  levelDetails: {
    color: 'white',
    fontSize: 14,
    marginTop: 5,
    opacity: 0.8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: 'red',
    marginBottom: 20,
  },
  totalScore: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 20,
    textAlign: 'center',
  },
  lockedLevel: {
    backgroundColor: '#cccccc',
    opacity: 0.7,
  },
  lockedText: {
    color: '#666666',
  },
  scoreBreakdown: {
    position: 'absolute',
    top: 100,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 10,
    borderRadius: 5,
    zIndex: 1000,
  },
  breakdownText: {
    color: '#4CAF50',
    fontSize: 18,
    fontWeight: 'bold',
  },
  breakdownDetails: {
    color: 'white',
    fontSize: 12,
  },
  unlockMessage: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -150 }, { translateY: -25 }],
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
    padding: 20,
    borderRadius: 10,
    zIndex: 1000,
    width: 300,
    alignItems: 'center',
  },
  unlockText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  backButton: {
    marginTop: Platform.OS === 'ios' ? 0 : 10, // Adjust based on SafeAreaView
    marginLeft: 10,
    padding: 10,
    backgroundColor: '#333',
    borderRadius: 8,
    zIndex: 1000,
  },
  backButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  letterContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    aspectRatio: 1,
  },
  letterText: {
    fontFamily: Platform.OS === 'ios' ? 'Helvetica' : 'normal',
    fontWeight: 'bold',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    aspectRatio: 1,
    maxWidth: Math.min(Dimensions.get('window').width * 0.9, 400),
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 10,
    alignSelf: 'center',
  },
  letterWrapper: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageContainer: {
    position: 'absolute',
    top: 120,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  successMessageWrapper: {
    backgroundColor: 'rgba(76, 175, 80, 0.9)', // Green
    padding: 10,
    borderRadius: 5,
  },
  errorMessageWrapper: {
    backgroundColor: 'rgba(244, 67, 54, 0.9)', // Red
    padding: 10,
    borderRadius: 5,
  },
  successMessage: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorMessage: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});