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
  if (!email) return null;
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
  if (!myUid || !friendUid || myUid === friendUid) return;
  
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
  if (!myUid) {
    callback([]);
    return () => {};
  }
  const q = query(collection(db, "friendships"), where("users", "array-contains", myUid));
  
  const userListeners = new Map<string, () => void>();
  const friendsData = new Map<string, UserProfile>();

  const unsubFriendships = onSnapshot(q, (snap) => {
    const friendUids = snap.docs.map(doc => {
      const data = doc.data() as Friendship;
      return data.users.find(id => id !== myUid);
    }).filter(Boolean) as string[];

    // Unsubscribe from users no longer in friend list
    userListeners.forEach((unsub, uid) => {
      if (!friendUids.includes(uid)) {
        unsub();
        userListeners.delete(uid);
        friendsData.delete(uid);
      }
    });

    // Subscribe to new friends
    friendUids.forEach(uid => {
      if (!userListeners.has(uid)) {
        const unsub = onSnapshot(doc(db, "users", uid), (userDoc) => {
          if (userDoc.exists()) {
            friendsData.set(uid, userDoc.data() as UserProfile);
            // Sort or filter could be added here if needed
            callback(Array.from(friendsData.values()));
          }
        }, (error) => {
          if (error.code !== 'resource-exhausted') {
            console.error(`Error listening to friend ${uid}:`, error);
          }
        });
        userListeners.set(uid, unsub);
      }
    });

    if (friendUids.length === 0) {
      callback([]);
    }
  }, (error) => {
    if (error.code !== 'resource-exhausted') {
      handleFirestoreError(error, OperationType.LIST, "friendships");
    }
  });

  return () => {
    unsubFriendships();
    userListeners.forEach(unsub => unsub());
    userListeners.clear();
  };
};
