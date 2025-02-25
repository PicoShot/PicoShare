import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";

// Types
interface UserState {
  isLoading: boolean;
  isAuth: boolean;
  error: string | null;
  name: string | null;
}

// Initial State
const initialState: UserState = {
  isLoading: false,
  isAuth: false,
  error: null,
  name: null,
};

// Thunks
export const register = createAsyncThunk<string, { name: string }>(
  "user/register",
  async ({ name }) => {
    localStorage.setItem("name", name);
    return name;
  }
);

export const autoLogin = createAsyncThunk<string>(
  "user/autoLogin",
  async () => {
    const name = localStorage.getItem("name");
    console.log(name);
    if (name && name != "" ) {
      return name;
    } else {
      throw new Error("No stored name found");
    }
  }
);

// Slice
const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // Register
      .addCase(register.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action: PayloadAction<string>) => {
        state.isLoading = false;
        state.isAuth = true;
        state.name = action.payload;
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || "Failed to register";
      })
      // Auto Login
      .addCase(autoLogin.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(autoLogin.fulfilled, (state, action: PayloadAction<string>) => {
        state.isLoading = false;
        state.isAuth = true;
        state.name = action.payload;
      })
      .addCase(autoLogin.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || "Auto login failed";
      });
  },
});

export default userSlice.reducer;
