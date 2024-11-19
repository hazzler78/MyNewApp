import { Text, View, StyleSheet, TouchableOpacity, Dimensions, Animated, Platform, Image } from "react-native";
import { useState, useEffect, useRef } from "react";
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Fly = {
  id: string;
  position: { top: number; left: number };
};

type Level = {
  name: string;
  timeLimit: number;
  numberOfFlies: number;
  pointsPerFly: number;
  colors: string[];
};

type HighScores = {
  beginner: number;
  advanced: number;
  expert: number;
};

const LEVELS: Level[] = [
  {
    name: "Beginner",
    timeLimit: 30,
    numberOfFlies: 8,
    pointsPerFly: 1,
    colors: ['#a8e6cf', '#dcedc1'] as const
  },
  {
    name: "Advanced",
    timeLimit: 25,
    numberOfFlies: 5,
    pointsPerFly: 1,
    colors: ['#ffd3b6', '#ffaaa5'] as const
  },
  {
    name: "Expert",
    timeLimit: 20,
    numberOfFlies: 3,
    pointsPerFly: 1,
    colors: ['#ff8b94', '#ff6b6b'] as const
  }
];

const generateNewFlyPosition = () => {
  const FLY_SIZE = 50;
  const HEADER_HEIGHT = 100;
  const BOTTOM_PADDING = 150;
  const SIDE_PADDING = 20;
  
  const windowWidth = Dimensions.get('window').width;
  const windowHeight = Dimensions.get('window').height;
  
  // Ensure flies stay fully within visible area
  const maxLeft = windowWidth - FLY_SIZE - SIDE_PADDING;
  const maxTop = windowHeight - FLY_SIZE - BOTTOM_PADDING;
  const minLeft = SIDE_PADDING;
  const minTop = HEADER_HEIGHT + SIDE_PADDING;
  
  // Round positions to prevent partial pixel placement
  return {
    left: Math.floor(Math.random() * (maxLeft - minLeft)) + minLeft,
    top: Math.floor(Math.random() * (maxTop - minTop)) + minTop
  };
};

// Add this component before the main Index component
const Fly = ({ id, position, onCatch }: { id: string; position: { top: number; left: number }; onCatch: (id: string, position: { top: number; left: number }) => void }) => {
  const windowHeight = Dimensions.get('window').height;
  const isNearBottom = position.top > (windowHeight - 200);

  return (
    <TouchableOpacity
      onPress={() => onCatch(id, position)}
      style={[
        styles.fly,
        {
          top: position.top,
          left: position.left,
          padding: isNearBottom ? 15 : 5,
        },
      ]}
    >
      {Platform.OS === 'web' ? (
        <Image 
          source={require('../assets/fly.png')} 
          style={styles.flyImage}
          resizeMode="contain"
        />
      ) : (
        <Text style={styles.flyEmoji}>🪰</Text>
      )}
    </TouchableOpacity>
  );
};

// Add this component next to the Fly component
const Splat = ({ position }: { position: { top: number; left: number } }) => {
  return (
    <View
      style={[
        styles.splat,
        {
          top: position.top,
          left: position.left,
        },
      ]}
    >
      {Platform.OS === 'web' ? (
        <Image 
          source={require('../assets/splat.png')} 
          style={styles.splatImage}
          resizeMode="contain"
        />
      ) : (
        <Text style={styles.splatEmoji}>💥</Text>
      )}
    </View>
  );
};

export default function Index() {
  const [count, setCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [highScores, setHighScores] = useState<{ [key: number]: number }>({
    0: 0, // Beginner
    1: 0, // Advanced
    2: 0  // Expert
  });
  const [buttonPosition, setButtonPosition] = useState({ top: 0, left: 0 });
  const [splats, setSplats] = useState<Array<{top: number, left: number}>>([]);
  const rotation = useRef(new Animated.Value(0));
  const [gameStartTime, setGameStartTime] = useState<number>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [gameStatus, setGameStatus] = useState<'idle' | 'countdown' | 'playing' | 'ended'>('idle');
  const [flies, setFlies] = useState<Fly[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(0);
  const [score, setScore] = useState(0);

  const selectLevel = (index: number) => {
    setCurrentLevel(index);
  };

  // Add some console logs to help us debug
  useEffect(() => {
    console.log('Game Status:', gameStatus);
    console.log('Time Left:', timeLeft);
    console.log('Is Playing:', isPlaying);
  }, [gameStatus, timeLeft, isPlaying]);

  const startGame = () => {
    // Reset everything
    setFlies([]);
    setSplats([]);
    setScore(0);
    setGameStatus('countdown');
    setCountdown(3);
    setIsPlaying(false);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          
          // Start the game with correct number of flies
          setTimeout(() => {
            setGameStatus('playing');
            setTimeLeft(LEVELS[currentLevel].timeLimit);
            setIsPlaying(true);
            
            // Create initial flies
            const initialFlies = Array.from(
              { length: LEVELS[currentLevel].numberOfFlies },
              (_, index) => ({
                id: `fly-${Date.now()}-${index}`,
                position: generateNewFlyPosition()
              })
            );
            setFlies(initialFlies);
          }, 1000);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Game timer
  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (isPlaying && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((current) => {
          const newTime = current - 1;
          if (newTime <= 0) {
            clearInterval(timer);
            setIsPlaying(false);
            setGameStatus('ended');
            return 0;
          }
          return newTime;
        });
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying]);

  const catchFly = (flyId: string, position: { top: number; left: number }) => {
    if (!isPlaying || timeLeft <= 0) return;

    // Add splat effect
    setSplats(prev => [...prev, position]);

    // Update score
    setScore(prev => prev + 1);

    // Remove caught fly and add new one immediately
    setFlies(prev => {
      const remaining = prev.filter(f => f.id !== flyId);
      const newFly = {
        id: `fly-${Date.now()}-${Math.random()}`,
        position: generateNewFlyPosition()
      };
      return [...remaining, newFly];
    });

    // Clean up splat
    setTimeout(() => {
      setSplats(prev => prev.filter(p => p !== position));
    }, 1000);
  };

  const generateNewFlyPosition = () => {
    const FLY_SIZE = 50;
    const HEADER_HEIGHT = 100;
    const BOTTOM_PADDING = 150;
    const SIDE_PADDING = 20;
    
    const windowWidth = Dimensions.get('window').width;
    const windowHeight = Dimensions.get('window').height;
    
    // Ensure flies stay fully within visible area
    const maxLeft = windowWidth - FLY_SIZE - SIDE_PADDING;
    const maxTop = windowHeight - FLY_SIZE - BOTTOM_PADDING;
    const minLeft = SIDE_PADDING;
    const minTop = HEADER_HEIGHT + SIDE_PADDING;
    
    // Round positions to prevent partial pixel placement
    return {
      left: Math.floor(Math.random() * (maxLeft - minLeft)) + minLeft,
      top: Math.floor(Math.random() * (maxTop - minTop)) + minTop
    };
  };

  // Add this useEffect to maintain correct number of flies
  useEffect(() => {
    if (isPlaying && gameStatus === 'playing') {
      const targetFlies = LEVELS[currentLevel].numberOfFlies;
      
      if (flies.length !== targetFlies) {
        console.log('Adjusting fly count:', {
          current: flies.length,
          target: targetFlies
        });
        
        if (flies.length < targetFlies) {
          // Add missing flies
          const newFlies = Array.from(
            { length: targetFlies - flies.length },
            () => ({
              id: `fly-${Date.now()}-${Math.random()}`,
              position: generateNewFlyPosition()
            })
          );
          setFlies(prev => [...prev, ...newFlies]);
        } else {
          // Remove extra flies if somehow we have too many
          setFlies(prev => prev.slice(0, targetFlies));
        }
      }
    }
  }, [flies.length, isPlaying, gameStatus, currentLevel]);

  return (
    <View style={styles.container}>
      {/* Game header */}
      <View style={styles.header}>
        <Text style={styles.title}>Fly Swatter!</Text>
        <Text style={styles.timer}>Time: {timeLeft}s</Text>
        <Text style={styles.score}>Score: {score}</Text>
      </View>

      {/* Game area */}
      {gameStatus === 'playing' && (
        <View style={styles.gameArea}>
          {flies.map((fly) => (
            <Fly
              key={fly.id}
              id={fly.id}
              position={fly.position}
              onCatch={catchFly}
            />
          ))}
          {splats.map((position, index) => (
            <Splat key={index} position={position} />
          ))}
        </View>
      )}

      {/* Countdown overlay */}
      {gameStatus === 'countdown' && countdown !== null && (
        <View style={styles.countdownOverlay}>
          <Text style={styles.countdownText}>{countdown}</Text>
        </View>
      )}

      {/* Game over screen */}
      {gameStatus === 'ended' && (
        <View style={styles.overlay}>
          <Text style={styles.gameOver}>Game Over!</Text>
          <Text style={styles.finalScore}>Score: {score}</Text>
          <TouchableOpacity 
            style={styles.button}
            onPress={() => setGameStatus('idle')}
          >
            <Text style={styles.buttonText}>Play Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Level selection */}
      {gameStatus === 'idle' && (
        <View style={styles.buttonContainer}>
          {LEVELS.map((level, index) => (
            <TouchableOpacity
              key={level.name}
              style={[
                styles.levelButton,
                currentLevel === index ? styles.selectedLevel : null
              ]}
              onPress={() => {
                selectLevel(index);
                startGame();
              }}
            >
              <Text style={styles.buttonText}>{level.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 20,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  subtitle: {
    fontSize: 18,
    color: 'white',
    marginTop: 5,
  },
  timer: {
    fontSize: 20,
    color: 'white',
    marginTop: 5,
  },
  score: {
    fontSize: 20,
    color: 'white',
    marginTop: 5,
  },
  buttonContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  instructions: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: 'center',
  },
  levelButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    width: '100%',
    maxWidth: 300,
    marginVertical: 10,
    alignItems: 'center',
  },
  selectedLevel: {
    backgroundColor: '#2E7D32',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  levelDetails: {
    color: 'white',
    fontSize: 14,
    marginTop: 5,
  },
  gameArea: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    position: 'relative',
    overflow: 'hidden',
    marginTop: 0,
    marginBottom: 0,
    paddingHorizontal: 40,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  countdownText: {
    fontSize: 100,
    fontWeight: 'bold',
    color: 'white',
  },
  gameOver: {
    fontSize: 48,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 20,
  },
  finalScore: {
    fontSize: 24,
    color: 'white',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    minWidth: 200,
    alignItems: 'center',
  },
  fly: {
    position: 'absolute',
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  flyImage: {
    width: '100%',
    height: '100%',
  },
  flyEmoji: {
    fontSize: 35,
    lineHeight: 40,
    textAlign: 'center',
    includeFontPadding: false,
  },
  splat: {
    position: 'absolute',
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splatImage: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },
  splatEmoji: {
    fontSize: 30,
  },
});