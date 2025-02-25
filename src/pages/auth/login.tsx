"use client";
import React, {useEffect, useState, useMemo} from "react";
import {useSelector} from "react-redux";
import {RootState} from "../../store/store";
import {useAppDispatch} from "../../hooks/useAppDispatch";
import {register, autoLogin} from "../../store/slices/userSlice";
import {Input, Button, Spacer} from "@heroui/react";
import {isLength} from "validator";
import {useNavigate} from "react-router-dom";

function Login() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const isLoading = useSelector((state: RootState) => state.user.isLoading);
  const isAuth = useSelector((state: RootState) => state.user.isAuth);

  const validateEmail = (email: string) =>
    isLength(email, {min: 3, max: 15});
  const isNameInvalid = useMemo(() => {
    if (name === "") return false;
    return !validateEmail(name);
  }, [name]);

  const dispatch = useAppDispatch();

  useEffect(() => {
    if (isAuth) {
      navigate("/home");
    }
  }, [isAuth]);

  useEffect(() => {
    localStorage.getItem("name");
    dispatch(autoLogin());
  }, [isAuth, dispatch]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(register({name}));
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className=" p-8 rounded-xl max-w-md w-full transform-gpu duration-700">
        <h2 className="text-2xl font-bold text-white mb-6 text-center fade-item">
          Welcome
        </h2>
        <Spacer y={3}/>
        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            isClearable={true}
            isRequired={true}
            variant="bordered"
            type="text"
            label="Name"
            className="max-w-full fade-item"
            disabled={isLoading}
            isInvalid={isNameInvalid}
            color={isNameInvalid ? "danger" : "default"}
            errorMessage="Please enter valid name!"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onClear={() => setName("")}
            size="sm"
          />
          <Button
            isLoading={isLoading}
            type="submit"
            className={`w-full text-white font-semibold transition-colors fade-item duration-500 ${
              isAuth
                ? "bg-green-600 hover:bg-green-500"
                : "bg-purple-900 hover:bg-purple-950"
            }`}
            disabled={isLoading}
          >
            {isAuth ? "Success" : isLoading ? "Loading..." : "Get Started"}
          </Button>
        </form>
        <Spacer y={2}/>
      </div>
    </div>
  );
}

export default Login;
