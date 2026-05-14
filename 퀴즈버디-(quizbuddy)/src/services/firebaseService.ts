import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  onSnapshot,
  serverTimestamp,
  orderBy,
  limit
} from "firebase/firestore";
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User
} from "firebase/auth";
import { db, auth } from "../lib/firebase";
import { UserProfile, UserStatus, Friendship } from "../types";

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const loginWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    await syncUserProfile(user);
    return user;
  } catch (error) {
    console.error("Login Error:", error);
    return null;
  }
};

export const logout = () => signOut(auth);

export const syncUserProfile = async (user: User) => {
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);
  
  const userData: UserProfile = {
    uid: user.uid,
    displayName: user.displayName || "따끈한 전학생",
    email: user.email || "",
    photoURL: user.photoURL || "",
    status: UserStatus.OFFLINE,
    lastSeen: new Date().toISOString()
  };

  if (!userSnap.exists()) {
    try {
      await setDoc(userRef, userData);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}`);
    }
  } else {
    // Just update last seen
    try {
      await setDoc(userRef, { lastSeen: new Date().toISOString() }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  }
};

export const updateUserProfile = async (uid: string, data: Partial<UserProfile>) => {
  const userRef = doc(db, "users", uid);
  try {
    await setDoc(userRef, { ...data, lastSeen: new Date().toISOString() }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
};

export const updateUserStatus = async (uid: string, status: UserStatus) => {
  const userRef = doc(db, "users", uid);
  try {
    await setDoc(userRef, { status, lastSeen: new Date().toISOString() }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
};

export const searchUserByEmail = async (email: string) => {
  const q = query(collection(db, "users"), where("email", "==", email), limit(1));
  try {
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].data() as UserProfile;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, "users");
    return null;
  }
};

export const addFriend = async (myUid: string, friendUid: string) => {
  if (myUid === friendUid) return;
  
  // Check if already friends
  const q = query(
    collection(db, "friendships"), 
    where("users", "array-contains", myUid)
  );
  
  try {
    const snap = await getDocs(q);
    const alreadyFriends = snap.docs.some(doc => {
      const data = doc.data() as Friendship;
      return data.users.includes(friendUid);
    });
    
    if (alreadyFriends) return;

    await addDoc(collection(db, "friendships"), {
      users: [myUid, friendUid],
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "friendships");
  }
};

export const subscribeToFriends = (myUid: string, callback: (friends: UserProfile[]) => void) => {
  const q = query(collection(db, "friendships"), where("users", "array-contains", myUid));
  
  return onSnapshot(q, async (snap) => {
    const friendUids = snap.docs.map(doc => {
      const data = doc.data() as Friendship;
      return data.users.find(id => id !== myUid);
    }).filter(Boolean) as string[];

    if (friendUids.length === 0) {
      callback([]);
      return;
    }

    // Since we can't easily reactively listen to MANY individual docs with a single collection query on IDs (without 'in' limit)
    // We'll listen to each friend doc
    const friends: UserProfile[] = [];
    const unsubscribers: (() => void)[] = [];

    friendUids.forEach(uid => {
      const unsub = onSnapshot(doc(db, "users", uid), (userDoc) => {
        if (userDoc.exists()) {
          const profile = userDoc.data() as UserProfile;
          const index = friends.findIndex(f => f.uid === profile.uid);
          if (index > -1) {
            friends[index] = profile;
          } else {
            friends.push(profile);
          }
          callback([...friends]);
        }
      });
      unsubscribers.push(unsub);
    });

    return () => unsubscribers.forEach(u => u());
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, "friendships");
  });
};
