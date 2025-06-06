import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import Card, { CardStyle } from "../../components/system/Card";
import Button, { ButtonColor } from "../../components/system/Button";
import { useAuth } from "../../lib/AuthContext";
import ProfileImage from "../../components/ProfileImage";

import {
  imagesUploadImage,
  userUpdate,
  userFindMe,
  UpdateProfileDto,
  forumFindPostsByUser,
  userListFriends,
  UserDto,
  ActionWithRelationDto,
  PostDto,
  actionsFindCompletedForUser,
} from "@alliance/shared/client";
import { getImageSource } from "../../lib/config";

const ProfileEditPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Loading state to avoid flicker while we wait for auth context to resolve
  const [loading, setLoading] = useState(true);

  // Editable form state
  const [name, setName] = useState<string>("");
  const [bio, setBio] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [completedActions, setCompletedActions] = useState<
    ActionWithRelationDto[]
  >([]);
  const [forumPosts, setForumPosts] = useState<PostDto[]>([]);
  const [friends, setFriends] = useState<UserDto[]>([]);

  // Error & submit state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** initialise local state from user profile once available */
  useEffect(() => {
    async function loadProfile() {
      if (user) {
        //full profiledto vs auth userdto
        const response = await userFindMe();
        if (!response.data) {
          setError("Something went wrong while loading your profile.");
          return;
        }
        setName(response.data.name || "");
        setBio(response.data.profileDescription || "");
        setAvatarUrl(response.data.profilePicture || null);

        const { data: friendsData } = await userListFriends({
          path: { id: user.id },
        });
        if (friendsData) {
          setFriends(friendsData);
        }

        const { data: forumPostsData } = await forumFindPostsByUser({
          path: { id: user.id },
        });
        if (forumPostsData) {
          setForumPosts(forumPostsData);
        }

        actionsFindCompletedForUser({ path: { id: user.id } }).then(
          (response) => {
            if (response.data) {
              setCompletedActions(response.data);
            }
          }
        );
      }
      setLoading(false);
    }
    if (user) {
      setName(user.name); //prefill data from auth
      loadProfile();
    }
  }, [user]);

  /**
   * Handle avatar <input type="file"> change – preview immediately and stash the
   * File object so we can send it on save.
   */
  const handleAvatarChange: React.ChangeEventHandler<HTMLInputElement> = (
    e
  ) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    // Basic client‑side validation – you could add file‑type/size checks here
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }

    setAvatarFile(file);
    setError(null);

    // Show immediate preview
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAvatarUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  /**
   * Save button – upload image first (if a new one was selected) then PATCH the
   * profile with name, bio & returned image URL.
   */
  const handleSave = async () => {
    console.log("handleSave");
    if (!user) return;

    setSubmitting(true);
    setError(null);
    console.log("handleSave 2");

    try {
      let uploadedFilename: string | undefined = undefined;

      if (avatarFile) {
        const response = await imagesUploadImage({
          body: { image: avatarFile },
        });
        console.log("got image upload response");
        if (response.data) {
          uploadedFilename = response.data.filename;
        }
      }

      console.log("handleSave 3");

      const payload: UpdateProfileDto = {
        name,
        profileDescription: bio,
        profilePicture: uploadedFilename ?? avatarUrl ?? undefined,
      };
      const response = await userUpdate({
        body: payload,
      });

      console.log("got response", response);

      navigate(`/user/${user.id}`);
    } catch (err: unknown) {
      console.error(err);
      setError("Something went wrong while saving.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-pagebg pt-20 px-8 md:px-16 flex items-center justify-center">
        <p className="text-stone-500">Loading profile…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-pagebg pt-20 px-8 md:px-16 flex items-center justify-center">
        <Card style={CardStyle.White} className="p-8 text-center space-y-4">
          <p>You must be logged in to edit your profile.</p>
          <Button onClick={() => navigate("/login")}>Log in</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-[800px] mx-auto space-y-2">
      <div className="w-full h-[100px]"></div>
      <div className="px-8 relative space-y-2 border-stone-300 border rounded mx-2">
        <div className="relative w-fit">
          <ProfileImage
            src={
              avatarFile
                ? URL.createObjectURL(avatarFile)
                : avatarUrl
                ? getImageSource(avatarUrl)
                : null
            }
            className="mt-[-55px]"
          />
          <label className="cursor-pointer text-blue-600 underline text-sm absolute -top-5">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            Change photo
          </label>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border-none focus:outline-none text-[22pt] font-bold font-berlingske"
          />
        </div>
        {/* stats row */}
        <div className="flex flex-row gap-5 cursor-pointer">
          <p>
            <b>{completedActions.length} </b>
            actions completed
          </p>
          <p>
            <b>{forumPosts.length} </b>
            forum posts
          </p>
          <p>
            <b>{friends.length} </b>
            Friends
          </p>
        </div>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={6}
          className="w-full border border-stone-300 focus:outline-none p-2 -ml-2 mt-2"
        />
        {/* button row */}
        <div className="absolute right-0 top-0 space-x-3 flex flex-row p-5">
          <Button color={ButtonColor.Blue} onClick={handleSave} className="">
            Save
          </Button>
        </div>
        {/* <div className="absolute -left-20 top-0 p-5">
          <BackButton />
          </div> */}
      </div>
    </div>
    // <div className="min-h-screen bg-pagebg pt-20 px-4 md:px-0">
    //   <div className="max-w-2xl mx-auto space-y-6">
    //     <Card style={CardStyle.White} className="p-8 space-y-6">
    //       <h1 className="text-2xl font-semibold text-center">Edit Profile</h1>

    //       {/* Avatar upload / preview */}
    //       <div className="flex flex-col items-center gap-4">
    //         <ProfileImage
    //           src={avatarUrl}
    //           className="w-24 h-24 border-2 border-stone-300 rounded-full object-cover"
    //         />
    //         <label className="cursor-pointer text-blue-600 underline text-sm">
    //           <input
    //             type="file"
    //             accept="image/*"
    //             className="hidden"
    //             onChange={handleAvatarChange}
    //           />
    //           Change photo
    //         </label>
    //       </div>

    //       {/* Name input */}
    //       <div className="space-y-2">
    //         <label className="block font-medium">Display Name</label>
    //         <input
    //           type="text"
    //           value={name}
    //           onChange={(e) => setName(e.target.value)}
    //           className="w-full border border-stone-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
    //         />
    //       </div>

    //       {/* Bio markdown textarea */}
    //       <div className="space-y-2">
    //         <label className="block font-medium">Bio / Description</label>
    //         <textarea
    //           value={bio}
    //           onChange={(e) => setBio(e.target.value)}
    //           rows={6}
    //           className="w-full border border-stone-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
    //           placeholder="Write something about yourself (supports Markdown)"
    //         />
    //         <p className="text-xs text-stone-500">Markdown preview:</p>
    //         <div className="border border-dashed rounded-md p-3 prose max-w-none">
    //           {bio.trim() ? (
    //             <ReactMarkdown>{bio}</ReactMarkdown>
    //           ) : (
    //             <p className="text-stone-400 italic">Nothing to preview…</p>
    //           )}
    //         </div>
    //       </div>

    //       {error && <p className="text-red-600 text-sm text-center">{error}</p>}

    //       <div className="flex justify-end gap-4 pt-2">
    //         <Button
    //           color={ButtonColor.Light}
    //           disabled={submitting}
    //           onClick={() => navigate(-1)}
    //         >
    //           Cancel
    //         </Button>
    //         <Button
    //           color={ButtonColor.Blue}
    //           disabled={submitting}
    //           onClick={handleSave}
    //         >
    //           {submitting ? "Saving…" : "Save Changes"}
    //         </Button>
    //       </div>
    //     </Card>
    //   </div>
    // </div>
  );
};

export default ProfileEditPage;
