import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getAllSpotsThunk } from "../../store/spots";
import "./Spots.css";
import { Link } from "react-router-dom";

const SpotsIndex = () => {
  const spotsObj = useSelector((state) => state.spots);
  const spots = Object.values(spotsObj);
  //console.log("image check", spots);
  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(getAllSpotsThunk());
  }, [dispatch]);

  return (
    <>
      <h1 className="all-spots-h1">All spots</h1>
      <div className="wrapper-div">
        {spots.map((spot) => {
          return (
            <>
              <div className="spots-div" data-tooltip={spot.name}>
                <Link to={`/spot/${spot.id}`}>
                  {spot.previewImage !== "No Preview Image Available" ? (
                    <img src={spot.previewImage}></img>
                  ) : (
                    <img src="https://ftcollinshomes.com/wp-content/uploads/2015/06/nophotoavailable.png"></img>
                  )}
                  <div className="spot-wrapper-div">
                    <div className="spot-info">
                      <div key={spot.id} className="spot-location">
                        {spot.name}, {spot.city}, {spot.state}
                      </div>
                      <div className="spot-price-div">${spot.price} night</div>
                    </div>

                    <div className="spots-review-star">
                      ⭐️
                      {spot.avgRating !== "No Reviews exist for this spot"
                        ? spot.avgRating
                        : "New"}
                    </div>
                  </div>
                </Link>
              </div>
            </>
          ); 
        })}
      </div>
    </>
  );
};

export default SpotsIndex;
